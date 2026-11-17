"""Server-side image forensics. Every reported value is measured from the upload."""
from __future__ import annotations

import io
from typing import Any

from PIL import Image

from .scoring import clamp, confidence_for, score_signals, signal, uncertainty_for

EXIF_KEYS = {
    0x010F: "make",
    0x0110: "model",
    0x0131: "software",
    0x0132: "created",
    0x9003: "created_original",
    0xA434: "lens",
}
AI_TOOLS = ("midjourney", "stable diffusion", "dall-e", "dall e", "firefly", "dreamstudio", "leonardo", "synthetic", "ai generated")


def _u16(b: bytes, i: int) -> int:
    return (b[i] << 8) | b[i + 1]


def _parse_jpeg(data: bytes) -> dict[str, Any]:
    out: dict[str, Any] = {"quality": None, "progressive": None, "sampling": None, "trailing": 0, "restart": False}
    i = 2
    lum: bytes | None = None
    while i + 3 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        while marker == 0xFF:
            i += 1
            marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        if marker == 0xD9:
            break
        length = _u16(data, i + 2)
        if length < 2 or i + 2 + length > len(data):
            break
        seg = data[i + 4 : i + 2 + length]
        if marker == 0xDB and seg and lum is None and len(seg) >= 64:
            lum = seg[1:65]
        elif marker in (0xC0, 0xC1, 0xC2):
            out["progressive"] = marker == 0xC2
            if len(seg) >= 7:
                sampling = seg[7]
                out["sampling"] = {0x11: "4:4:4", 0x21: "4:2:2", 0x22: "4:2:0"}.get(sampling, hex(sampling))
        elif marker == 0xDD:
            out["restart"] = True
        i += 2 + length
        if marker == 0xDA:
            break
    if lum:
        first = lum[0]
        out["quality"] = int(round(clamp(50 + (1 - first / 16) * 50, 1, 100))) if 0 < first <= 16 else int(round(clamp(800 / first, 1, 100)))
    eoi = data.rfind(b"\xff\xd9")
    out["trailing"] = len(data) - eoi - 2 if eoi >= 0 else 0
    return out


def _read_exif(img: Image.Image) -> dict[str, Any]:
    meta: dict[str, Any] = {"exif": False, "gps": False, "software": None, "camera": None, "created": None, "xmp": False}
    try:
        exif = img.getexif()
    except Exception:
        return meta
    if not exif:
        # XMP can still be present even without an EXIF IFD.
        meta["xmp"] = b"http://ns.adobe.com/xap/" in img.info.get("xmp", b"") or "xmp" in img.info
        return meta
    meta["exif"] = True
    values = {EXIF_KEYS.get(k, k): v for k, v in exif.items() if k in EXIF_KEYS}
    make = str(values.get("make") or "").strip()
    model = str(values.get("model") or "").strip()
    meta["camera"] = f"{make} {model}".strip() or None
    sw = values.get("software")
    if isinstance(sw, bytes):
        sw = sw.decode("utf-8", "ignore")
    meta["software"] = str(sw).strip("\x00 ").strip() or None if sw else None
    created = values.get("created_original") or values.get("created")
    meta["created"] = str(created)[:32] if created else None
    try:
        meta["gps"] = bool(exif.get_ifd(0x8825))
    except Exception:
        meta["gps"] = False
    meta["xmp"] = b"http://ns.adobe.com/xap/" in img.info.get("xmp", b"") or "xmp" in img.info
    return meta


def _pixels(img: Image.Image) -> dict[str, Any]:
    work = img.convert("L").copy()
    work.thumbnail((384, 384), Image.Resampling.BILINEAR)
    w, h = work.size
    raw = work.tobytes()
    px = lambda x, y: raw[y * w + x] if 0 <= x < w and 0 <= y < h else 0

    noise_sum = flat_sum = 0.0
    count = flat_count = edges = 0
    total = squares = 0.0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            v = px(x, y)
            total += v
            squares += v * v
            diff = abs(v - (px(x - 1, y) + px(x + 1, y) + px(x, y - 1) + px(x, y + 1)) / 4)
            noise_sum += diff
            count += 1
            if diff > 14:
                edges += 1
            mn, mx = 255, 0
            for dy in (-2, 0, 2):
                for dx in (-2, 0, 2):
                    n = px(x + dx, y + dy)
                    mn = min(mn, n)
                    mx = max(mx, n)
            if mx - mn < 8:
                flat_sum += diff
                flat_count += 1
    mean = total / count if count else 0
    variance = max(0.0, squares / count - mean * mean) if count else 0

    block = 12
    signatures: list[tuple[int, int, int]] = []
    color = img.convert("RGB").copy()
    color.thumbnail((384, 384), Image.Resampling.BILINEAR)
    cw, ch = color.size
    cdata = color.tobytes()
    for by in range(0, ch - block + 1, block):
        for bx in range(0, cw - block + 1, block):
            r = g = b = 0
            for yy in range(block):
                for xx in range(block):
                    p = ((by + yy) * cw + bx + xx) * 3
                    r += cdata[p]
                    g += cdata[p + 1]
                    b += cdata[p + 2]
            n = block * block
            signatures.append((r // n, g // n, b // n))
    pairs = 0
    for i, a in enumerate(signatures):
        for b in signatures[i + 1 :]:
            if abs(a[0] - b[0]) < 3 and abs(a[1] - b[1]) < 3 and abs(a[2] - b[2]) < 3:
                pairs += 1

    denom = len(signatures) * (len(signatures) - 1) / 2
    return {
        "noise": round(noise_sum / count, 2) if count else None,
        "flat_noise": round(flat_sum / flat_count, 2) if flat_count > 40 else None,
        "edge_density": round(edges / count * 1000, 1) if count else None,
        "contrast": round(variance**0.5, 1),
        "repeated_blocks": round(pairs / denom * 1000, 1) if denom > 0 else None,
        "sampled_pixels": count,
        "width": img.width,
        "height": img.height,
    }


def analyze_image(data: bytes, filename: str, fmt: str) -> dict[str, Any]:
    img = Image.open(io.BytesIO(data))
    img.load()
    meta = _read_exif(img)
    pix = _pixels(img)
    enc: dict[str, Any] = {"quality": None, "progressive": None, "sampling": None, "trailing": 0, "restart": False}
    if fmt == "jpeg":
        enc.update(_parse_jpeg(data))
    if fmt == "png":
        iend = data.rfind(b"IEND")
        enc["trailing"] = len(data) - iend - 8 if iend >= 0 else 0
        enc["progressive"] = bool(img.info.get("interlace"))
        enc["sampling"] = "lossless"

    signals: list[dict] = []
    sw = meta["software"] or ""
    if any(t in sw.lower() for t in AI_TOOLS):
        signals.append(signal("AI generator named in metadata", f'The file records "{sw}" as its creator.', "high", "negative"))
    elif sw and any(t in sw.lower() for t in ("photoshop", "gimp", "lightroom", "canva", "affinity", "pixelmator", "illustrator")):
        signals.append(signal("Editing software in metadata", f"The file records editing software ({sw}) — this is not a straight camera original.", "medium", "negative"))
    if meta["exif"]:
        signals.append(signal("Camera metadata present", f"Capture device recorded: {meta['camera']}." if meta["camera"] else "EXIF block present.", "low", "positive"))
    else:
        signals.append(signal("No camera metadata", "No EXIF block was found. Common after screenshots and re-uploads.", "low", "negative"))
    if meta["gps"]:
        signals.append(signal("GPS capture data present", "Original location metadata is still attached.", "medium", "positive"))
    if meta["created"]:
        signals.append(signal("Original capture date recorded", f"DateTimeOriginal: {meta['created']}.", "low", "positive"))
    if enc["trailing"] and enc["trailing"] > 32:
        signals.append(signal("Data appended after image end", f"{enc['trailing']} bytes follow the end-of-image marker.", "high" if enc["trailing"] > 4096 else "medium", "negative"))
    q = enc["quality"]
    if q is not None and q < 70:
        signals.append(signal("Heavy JPEG compression", f"Quantization tables indicate roughly {q}% quality — usually means re-encoding.", "low", "negative"))
    elif q is not None and q >= 85:
        signals.append(signal("High-quality encoding", f"Quantization tables indicate roughly {q}% quality.", "low", "positive"))
    if pix["flat_noise"] is not None and pix["noise"] is not None and pix["flat_noise"] < 1.2 and pix["noise"] < 2.4 and pix["sampled_pixels"] > 20000:
        signals.append(signal("Unusually uniform texture", f"Flat-region noise {pix['flat_noise']} with edge density {pix['edge_density']}%. Synthetic and heavily smoothed images often look like this.", "medium", "negative"))
    if pix["repeated_blocks"] is not None and pix["repeated_blocks"] > 4:
        signals.append(signal("Repeated texture blocks", f"{pix['repeated_blocks']}% of sampled blocks share near-identical average colour.", "medium", "negative"))
    if pix["contrast"] < 18:
        signals.append(signal("Very low contrast", f"Luminance spread is only {pix['contrast']}/255.", "low", "negative"))
    signals.append(signal("Pixel statistics sampled", f"Measured {pix['sampled_pixels']:,} pixels: noise {pix['noise']}, flat-region noise {pix['flat_noise']}, edges {pix['edge_density']}%.", "low", "neutral"))

    score = score_signals(signals)
    strong = any(s["severity"] == "high" and s["impact"] == "negative" for s in signals)
    level = "manipulated" if strong else "authentic" if score >= 68 else "uncertain" if score >= 42 else "manipulated"
    labels = {"authentic": "Likely authentic", "uncertain": "Inconclusive", "manipulated": "Needs scrutiny"}
    conf = confidence_for(len(signals))

    lines = [
        f"File: {filename} · {fmt.upper()} · {pix['width']}×{pix['height']}px · {len(data) / 1024:.1f} KB",
        f"Encoding: quality {q if q is not None else 'n/a'} · sampling {enc['sampling'] or 'n/a'} · {'progressive' if enc['progressive'] else 'baseline' if enc['progressive'] is False else 'unknown'} · trailing bytes {enc['trailing']}",
        f"Metadata: EXIF {'present' if meta['exif'] else 'absent'} · GPS {'present' if meta['gps'] else 'absent'} · Software {meta['software'] or 'none'} · Camera {meta['camera'] or 'none'}",
        f"Pixels: {pix['sampled_pixels']:,} sampled · noise {pix['noise']} · flat-region noise {pix['flat_noise']} · edges {pix['edge_density']}%",
        "",
        *[f"• {s['label']}: {s['description']}" for s in signals],
    ]
    return {
        "truthScore": score,
        "authenticityStatus": level,
        "suspiciousIndicators": [{"label": s["label"], "description": s["description"], "severity": s["severity"]} for s in signals],
        "explanation": "\n".join(lines),
        "confidence": conf,
        "uncertainty": uncertainty_for(conf),
        "uncertaintyNote": "How much the score could change if more evidence were available.",
        "modelVersion": "server-forensics-v1",
    }

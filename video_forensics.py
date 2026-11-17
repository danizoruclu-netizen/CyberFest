"""Server-side video forensics: real frame sampling through bundled FFmpeg."""
from __future__ import annotations

import os
import tempfile
from typing import Any

from PIL import Image

from .scoring import clamp

GENERATOR = ("lavf", "ffmpeg", "handbrake", "obs studio", "adobe premiere", "after effects", "davinci")
CAMERA = ("iphone", "canon", "nikon", "sony", "samsung", "gopro", "dji", "pixel", "huawei", "xiaomi")
W, H = 224, 126


def _frame_stats(raw: bytes, size: tuple[int, int], previous: bytes | None) -> dict[str, Any]:
    img = Image.frombytes("RGB", size, raw).convert("L").resize((W, H), Image.Resampling.BILINEAR)
    g = img.tobytes()
    px = lambda x, y: g[y * W + x]
    noise = edges = diff = 0.0
    n = 0
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = px(x, y)
            d = abs(v - (px(x - 1, y) + px(x + 1, y) + px(x, y - 1) + px(x, y + 1)) / 4)
            noise += d
            if d > 14:
                edges += 1
            if previous:
                diff += abs(v - previous[y * W + x])
            n += 1
    return {
        "noise": round(noise / n, 2) if n else 0,
        "edges": round(edges / n * 1000, 1) if n else 0,
        "diff": round(diff / n, 2) if previous and n else None,
        "gray": g,
    }


def _container_scan(data: bytes) -> dict[str, bool]:
    head = data[:196608].lower()
    tail = data[-196608:].lower()
    scan = head + tail
    return {
        "generator": any(k.encode() in scan for k in GENERATOR),
        "camera": any(k.encode() in scan for k in CAMERA),
        "fast_start": b"moov" in head,
        "edit_list": b"elst" in scan,
    }


def analyze_video(data: bytes, filename: str) -> dict[str, Any]:
    import imageio_ffmpeg

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        reader = imageio_ffmpeg.read_frames(path, pix_fmt="rgb24")
        first = next(reader)
        size = first["size"]
        duration = float(first.get("duration") or 0)
        fps = float(first.get("fps") or 25)
        frames_total = int(first.get("nframes") or 0)
        if duration <= 0 and frames_total and fps:
            duration = frames_total / fps

        count = min(12, max(5, round(duration * 1.5))) if duration else 6
        samples: list[dict[str, Any]] = []
        previous: bytes | None = None
        for i in range(count):
            t = ((i + 0.5) / count) * duration if duration else i * 0.5
            if duration:
                one = imageio_ffmpeg.read_frames(path, pix_fmt="rgb24", input_params=["-ss", f"{t:.3f}"])
                next(one)
                raw = next(one, None)
                if raw is None:
                    continue
            else:
                raw = next(reader, None)
                if raw is None:
                    continue
            stats = _frame_stats(raw, size, previous)
            samples.append({"t": round(t, 2), **stats})
            previous = stats["gray"]

        if not samples:
            raise ValueError("No frames could be decoded from this video.")

        noises = sorted(s["noise"] for s in samples)
        median = noises[len(noises) // 2]
        step = duration / count if duration else 0.5
        suspicious: list[dict[str, Any]] = []
        timeline: list[dict[str, Any]] = []
        for i, s in enumerate(samples):
            frozen = s["diff"] is not None and s["diff"] < 1.1
            cut = s["diff"] is not None and s["diff"] > 46
            spike = s["noise"] > max(4, median * 2.1)
            score = int(clamp(8 + (64 if frozen else 0) + (34 if cut else 0) + (28 if spike else 0), 0, 100))
            timeline.append({"start": round(i * step, 1), "end": round((i + 1) * step, 1), "score": score})
            if frozen:
                suspicious.append({"timestamp": s["t"], "score": 74, "reason": "Near-identical to previous sample — possible freeze, loop or duplicated frames."})
            elif cut:
                suspicious.append({"timestamp": s["t"], "score": 52, "reason": "Abrupt frame change — hard cut or sudden content swap."})
            elif spike:
                suspicious.append({"timestamp": s["t"], "score": 58, "reason": f"Noise jumped to {s['noise']} (median {median}) — possible merge or re-encode boundary."})

        container = _container_scan(data)
        mean_diff = sum(s["diff"] for s in samples if s["diff"] is not None) / max(1, len(samples) - 1)
        verdict = "manipulated" if len(suspicious) >= 2 or (container["generator"] and suspicious) else "authentic"
        lines = [
            f"Container: {filename} · {len(data) / 1048576:.2f} MB · {duration:.2f}s",
            f"Decoded: {size[0]}×{size[1]} · {len(samples)} frames sampled evenly across the clip",
            f"Container scan: generator/re-encoder signatures {'FOUND' if container['generator'] else 'not found'} · camera signatures {'found' if container['camera'] else 'not found'} · fast-start {'yes' if container['fast_start'] else 'no'} · edit list {'present' if container['edit_list'] else 'absent'}",
            f"Frame stats: median high-frequency noise {median} · mean frame difference {mean_diff:.2f}",
            "",
            *(["• Re-encoding / editing software signature found in container metadata (lavf/ffmpeg family)."] if container["generator"] else []),
            *([f"• At {s['timestamp']:.1f}s: {s['reason']}" for s in suspicious] if suspicious else ["• No frozen, duplicated or noise-spiking frames were detected in the sampled set."]),
        ]
        return {
            "verdict": verdict,
            "confidence": int(clamp(58 + len(samples) * 2, 50, 86)),
            "durationSec": round(duration, 2) or None,
            "framesAnalyzed": len(samples),
            "suspiciousFrames": suspicious,
            "timeline": timeline,
            "explanation": "\n".join(lines),
        }
    finally:
        os.unlink(path)

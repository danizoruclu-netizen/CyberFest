/**
 * Local image forensics: reads real bytes, embedded metadata and decoded pixel
 * statistics. Everything reported here was measured from the uploaded file.
 * No network request is made and no AI classifier is run.
 */
import type { AuthenticityLevel, MediaAnalysisResult } from "@/lib/deepfake/analysis-result";
import {
  ascii,
  at,
  clamp,
  confidenceFor,
  includesAscii,
  scoreSignals,
  toIndicators,
  uncertaintyFor,
  type ForensicSignal,
} from "./forensics-shared";

export type ImageForensics = {
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  metadata: {
    exif: boolean;
    gps: boolean;
    software: string | null;
    camera: string | null;
    created: string | null;
    xmp: boolean;
    editingApp: boolean;
  };
  encoding: {
    quality: number | null;
    progressive: boolean | null;
    sampling: string | null;
    trailingBytes: number;
    restartMarkers: boolean;
  };
  pixels: {
    noise: number | null;
    flatNoise: number | null;
    edgeDensity: number | null;
    contrast: number | null;
    repeatedBlocks: number | null;
    sampledPixels: number;
  };
  signals: ForensicSignal[];
  score: number;
};

type Meta = ImageForensics["metadata"];
type Encoding = ImageForensics["encoding"];
type Pixels = ImageForensics["pixels"];

const EMPTY_META: Meta = { exif: false, gps: false, software: null, camera: null, created: null, xmp: false, editingApp: false };
const EMPTY_ENCODING: Encoding = { quality: null, progressive: null, sampling: null, trailingBytes: 0, restartMarkers: false };
const EMPTY_PIXELS: Pixels = { noise: null, flatNoise: null, edgeDensity: null, contrast: null, repeatedBlocks: null, sampledPixels: 0 };

/* ------------------------------------------------------------------ EXIF */

type Entry = { type: number; count: number; pos: number };

function readTiff(bytes: Uint8Array) {
  const meta: Meta = { ...EMPTY_META, exif: true };
  if (bytes.length < 8) return meta;
  const le = at(bytes, 0) === 0x49 && at(bytes, 1) === 0x49;
  const be = at(bytes, 0) === 0x4d && at(bytes, 1) === 0x4d;
  if (!le && !be) return meta;

  const u16 = (p: number) => (le ? at(bytes, p) | (at(bytes, p + 1) << 8) : (at(bytes, p) << 8) | at(bytes, p + 1));
  const u32 = (p: number) => {
    const a = at(bytes, p), b = at(bytes, p + 1), c = at(bytes, p + 2), d = at(bytes, p + 3);
    return (le ? a | (b << 8) | (c << 16) | (d << 24) : (a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  };
  if (u16(2) !== 42) return meta;

  const sizes = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  const readIfd = (offset: number) => {
    const entries = new Map<number, Entry>();
    if (offset < 0 || offset + 2 > bytes.length) return entries;
    const count = u16(offset);
    for (let i = 0; i < count; i++) {
      const p = offset + 2 + i * 12;
      if (p + 12 > bytes.length) break;
      entries.set(u16(p), { type: u16(p + 2), count: u32(p + 4), pos: p + 8 });
    }
    return entries;
  };
  const valuePos = (e: Entry) => {
    const size = sizes[e.type] ?? 1;
    return e.count * size > 4 ? u32(e.pos) : e.pos;
  };
  const numberValue = (e: Entry | undefined) => {
    if (!e) return null;
    const p = valuePos(e);
    if (e.type === 3) return u16(p);
    if (e.type === 4 || e.type === 9 || e.type === 10 || e.type === 8) return u32(p);
    return null;
  };
  const stringValue = (e: Entry | undefined) => {
    if (!e || e.type !== 2) return null;
    const p = valuePos(e);
    const raw = ascii(bytes, p, Math.min(e.count, 256)).replace(/\0+$/, "").trim();
    return raw.length ? raw : null;
  };

  const ifd0 = readIfd(u32(4));
  const exifPtr = numberValue(ifd0.get(0x8769));
  const gpsPtr = numberValue(ifd0.get(0x8825));
  const exifIfd = exifPtr ? readIfd(exifPtr) : new Map<number, Entry>();

  const make = stringValue(ifd0.get(0x010f));
  const model = stringValue(ifd0.get(0x0110));
  const software = stringValue(ifd0.get(0x0131));
  const created = stringValue(exifIfd.get(0x9003)) ?? stringValue(ifd0.get(0x0132));
  meta.gps = !!gpsPtr;
  meta.software = software;
  meta.camera = make && model ? `${make} ${model}` : make ?? model;
  meta.created = created;
  meta.editingApp = !!software && /photoshop|gimp|lightroom|canva|affinity|pixelmator|paint|illustrator|after effects|preview/i.test(software);
  return meta;
}

/* ------------------------------------------------------------- Containers */

function parseJpeg(u8: Uint8Array): { meta: Meta; encoding: Encoding } {
  const meta: Meta = { ...EMPTY_META };
  const encoding: Encoding = { ...EMPTY_ENCODING };
  let offset = 2;
  let luminanceTable: Uint8Array | null = null;

  while (offset + 3 < u8.length) {
    if (at(u8, offset) !== 0xff) { offset++; continue; }
    let marker = at(u8, offset + 1);
    while (marker === 0xff) { offset++; marker = at(u8, offset + 1); }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xd9) break;
    const len = (at(u8, offset + 2) << 8) | at(u8, offset + 3);
    if (len < 2 || offset + 2 + len > u8.length) break;
    const seg = u8.subarray(offset + 4, offset + 2 + len);

    if (marker === 0xe1) {
      if (ascii(seg, 0, 6) === "Exif\0\0") {
        meta.exif = true;
        Object.assign(meta, readTiff(seg.subarray(6)));
      } else if (ascii(seg, 0, 28).includes("http://ns.adobe.com/xap/1.0/")) {
        meta.xmp = true;
      }
    } else if (marker === 0xed && ascii(seg, 0, 13) === "Photoshop 3.0") {
      meta.editingApp = true;
      meta.software ??= "Adobe Photoshop (IPTC/IRB)";
    } else if (marker === 0xdb && seg.length > 1) {
      // First DQT is normally the luminance table.
      const precise = (at(seg, 0) >> 4) === 1;
      const table = seg.subarray(1, precise ? 129 : 65);
      if (!luminanceTable && table.length >= 64) luminanceTable = table;
    } else if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      encoding.progressive = marker === 0xc2;
      if (seg.length >= 6) {
        const sampling = at(seg, 7);
        encoding.sampling = sampling === 0x11 ? "4:4:4" : sampling === 0x21 ? "4:2:2" : sampling === 0x22 ? "4:2:0" : `0x${sampling.toString(16)}`;
      }
    } else if (marker === 0xdd) {
      encoding.restartMarkers = true;
    } else if (marker === 0xfe) {
      const comment = ascii(seg, 0, Math.min(seg.length, 160)).trim();
      if (comment) meta.software ??= comment;
    }
    offset += 2 + len;
    if (marker === 0xda) break;
  }

  if (luminanceTable) {
    const first = at(luminanceTable, 0);
    if (first > 0) {
      encoding.quality = first <= 16 ? Math.round(clamp(50 + (1 - first / 16) * 50, 1, 100)) : Math.round(clamp(800 / first, 1, 100));
    }
  }
  for (let i = u8.length - 2; i >= 0; i--) {
    if (at(u8, i) === 0xff && at(u8, i + 1) === 0xd9) {
      encoding.trailingBytes = u8.length - i - 2;
      break;
    }
  }
  return { meta, encoding };
}

function parsePng(u8: Uint8Array): { meta: Meta; encoding: Encoding } {
  const meta: Meta = { ...EMPTY_META };
  const encoding: Encoding = { ...EMPTY_ENCODING, progressive: false, sampling: "lossless" };
  let offset = 8;
  while (offset + 8 <= u8.length) {
    const size = ((at(u8, offset) << 24) | (at(u8, offset + 1) << 16) | (at(u8, offset + 2) << 8) | at(u8, offset + 3)) >>> 0;
    const type = ascii(u8, offset + 4, 4);
    const data = offset + 8;
    if (size > u8.length - data) break;
    if (type === "eXIf") {
      meta.exif = true;
      Object.assign(meta, readTiff(u8.subarray(data, data + size)));
    } else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const text = ascii(u8, data, Math.min(size, 512));
      const lower = text.toLowerCase();
      if (lower.includes("software") || lower.includes("creation time") || lower.includes("author")) {
        meta.software ??= text.split("\0").slice(-1)[0]?.slice(0, 80) ?? null;
        if (/photoshop|gimp|canva|lightroom|midjourney|stable diffusion/i.test(lower)) meta.editingApp = true;
      }
      if (lower.includes("xmp")) meta.xmp = true;
    } else if (type === "tIME" && size >= 7) {
      meta.created = `${at(u8, data)}-${String(at(u8, data + 1)).padStart(2, "0")}-${String(at(u8, data + 2)).padStart(2, "0")}`;
    } else if (type === "IEND") {
      encoding.trailingBytes = u8.length - (data + 4);
      break;
    }
    offset = data + size + 4;
  }
  return { meta, encoding };
}

function parseWebp(u8: Uint8Array): { meta: Meta; encoding: Encoding } {
  const meta: Meta = { ...EMPTY_META };
  const encoding: Encoding = { ...EMPTY_ENCODING, progressive: false, sampling: "lossy/lossless" };
  let offset = 12;
  while (offset + 8 <= u8.length) {
    const type = ascii(u8, offset, 4);
    const size = ((at(u8, offset + 4) << 24) | (at(u8, offset + 5) << 16) | (at(u8, offset + 6) << 8) | at(u8, offset + 7)) >>> 0;
    const data = offset + 8;
    if (size > u8.length - data) break;
    if (type === "EXIF") {
      meta.exif = true;
      Object.assign(meta, readTiff(u8.subarray(data, data + size)));
    } else if (type === "XMP ") meta.xmp = true;
    offset = data + size + (size % 2);
  }
  return { meta, encoding };
}

/* ---------------------------------------------------------- Pixel analysis */

function grayscale(data: Uint8ClampedArray, count: number) {
  const g = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    g[i] = 0.299 * (data[p] ?? 0) + 0.587 * (data[p + 1] ?? 0) + 0.114 * (data[p + 2] ?? 0);
  }
  return g;
}

async function analyzePixels(file: File): Promise<Pixels> {
  const empty = { ...EMPTY_PIXELS };
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return empty;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxSide = 384;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(8, Math.round(bitmap.width * scale));
    const h = Math.max(8, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return empty;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h).data;
    const g = grayscale(image, w * h);
    const px = (x: number, y: number) => g[y * w + x] ?? 0;

    let noiseSum = 0, noiseCount = 0, edges = 0, flatNoiseSum = 0, flatCount = 0;
    let sum = 0, sumSq = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const v = px(x, y);
        sum += v;
        sumSq += v * v;
        const diff = Math.abs(v - (px(x - 1, y) + px(x + 1, y) + px(x, y - 1) + px(x, y + 1)) / 4);
        noiseSum += diff;
        noiseCount++;
        if (diff > 14) edges++;
        let mn = 255, mx = 0;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            const n = px(x + dx, y + dy);
            if (n < mn) mn = n;
            if (n > mx) mx = n;
          }
        }
        if (mx - mn < 8) {
          flatNoiseSum += diff;
          flatCount++;
        }
      }
    }
    const mean = noiseCount ? sum / noiseCount : 0;
    const variance = noiseCount ? Math.max(0, sumSq / noiseCount - mean * mean) : 0;

    // Repeated 12x12 blocks: compare grid signatures (weak collage/synthesis signal).
    const block = 12;
    const signatures: { r: number; g: number; b: number }[] = [];
    for (let by = 0; by + block <= h - 2; by += block) {
      for (let bx = 0; bx + block <= w - 2; bx += block) {
        let r = 0, gg = 0, b = 0;
        for (let yy = 0; yy < block; yy++) {
          for (let xx = 0; xx < block; xx++) {
            const p = ((by + yy) * w + (bx + xx)) * 4;
            r += image[p] ?? 0;
            gg += image[p + 1] ?? 0;
            b += image[p + 2] ?? 0;
          }
        }
        const n = block * block;
        signatures.push({ r: r / n, g: gg / n, b: b / n });
      }
    }
    let pairs = 0;
    for (let i = 0; i < signatures.length; i++) {
      const a = signatures[i];
      if (!a) continue;
      for (let j = i + 1; j < signatures.length; j++) {
        const b = signatures[j];
        if (!b) continue;
        if (Math.abs(a.r - b.r) < 3 && Math.abs(a.g - b.g) < 3 && Math.abs(a.b - b.b) < 3) pairs++;
      }
    }

    return {
      noise: noiseCount ? Math.round((noiseSum / noiseCount) * 100) / 100 : null,
      flatNoise: flatCount > 40 ? Math.round((flatNoiseSum / flatCount) * 100) / 100 : null,
      edgeDensity: noiseCount ? Math.round((edges / noiseCount) * 1000) / 10 : null,
      contrast: Math.round(Math.sqrt(variance) * 10) / 10,
      repeatedBlocks: signatures.length > 4 ? Math.round((pairs / (signatures.length * (signatures.length - 1) / 2)) * 1000) / 10 : null,
      sampledPixels: noiseCount,
    };
  } catch {
    return empty;
  } finally {
    bitmap?.close();
  }
}

/* -------------------------------------------------------------- Signals */

const AI_TOOLS = /midjourney|stable diffusion|dall[- ]?e|firefly|dreamstudio|leonardo|generated|synthetic|ai image/i;

function buildSignals(meta: Meta, encoding: Encoding, pixels: Pixels): ForensicSignal[] {
  const out: ForensicSignal[] = [];
  const sw = meta.software ?? "";

  if (AI_TOOLS.test(sw)) {
    out.push({ label: "AI generator named in metadata", description: `The file records "${sw}" as its creator — a strong sign of synthetic origin.`, severity: "high", impact: "negative" });
  } else if (meta.editingApp) {
    out.push({ label: "Editing software in metadata", description: `The file records editing software (${sw || "image editor"}) — this is not a straight camera original.`, severity: "medium", impact: "negative" });
  }

  if (meta.exif) {
    out.push({ label: "Camera metadata present", description: meta.camera ? `Capture device recorded: ${meta.camera}.` : "EXIF block present — consistent with a camera original.", severity: "low", impact: "positive" });
  } else {
    out.push({ label: "No camera metadata", description: "No EXIF block was found. Common after screenshots, social-media re-uploads and resizing — a weak signal on its own.", severity: "low", impact: "negative" });
  }
  if (meta.gps) out.push({ label: "GPS capture data present", description: "Original location metadata is still attached, which is unusual for heavily reworked images.", severity: "medium", impact: "positive" });
  if (meta.created) out.push({ label: "Original capture date recorded", description: `DateTimeOriginal: ${meta.created}.`, severity: "low", impact: "positive" });
  if (meta.xmp) out.push({ label: "XMP metadata block present", description: "Adobe XMP metadata found — often added by editors or generators.", severity: "low", impact: "neutral" });

  if (encoding.trailingBytes > 32) {
    out.push({ label: "Data appended after image end", description: `${encoding.trailingBytes} bytes follow the end-of-image marker. This can be harmless metadata or a sign of editing/polyglot files.`, severity: encoding.trailingBytes > 4096 ? "high" : "medium", impact: "negative" });
  }
  if (encoding.quality !== null && encoding.quality < 70) {
    out.push({ label: "Heavy JPEG compression", description: `Quantization tables indicate roughly ${encoding.quality}% quality. Low quality can hide editing artefacts and usually means re-encoding.`, severity: "low", impact: "negative" });
  }
  if (encoding.quality !== null && encoding.quality >= 85) {
    out.push({ label: "High-quality encoding", description: `Quantization tables indicate roughly ${encoding.quality}% quality.`, severity: "low", impact: "positive" });
  }

  if (pixels.flatNoise !== null && pixels.noise !== null && pixels.flatNoise < 1.2 && pixels.noise < 2.4 && pixels.sampledPixels > 20000) {
    out.push({ label: "Unusually uniform texture", description: `Noise in flat regions (${pixels.flatNoise}) is almost absent while edges are present (${pixels.edgeDensity ?? "—"}%). Synthetic and heavily smoothed images often look like this — indicative only.`, severity: "medium", impact: "negative" });
  }
  if (pixels.repeatedBlocks !== null && pixels.repeatedBlocks > 4) {
    out.push({ label: "Repeated texture blocks", description: `${pixels.repeatedBlocks}% of sampled blocks share near-identical average colour. Common in synthetic textures and copy-stamped areas.`, severity: "medium", impact: "negative" });
  }
  if (pixels.contrast !== null && pixels.contrast < 18) {
    out.push({ label: "Very low contrast", description: `Luminance spread is only ${pixels.contrast}/255. Flattened contrast is typical of re-composited images and screenshots.`, severity: "low", impact: "negative" });
  }
  if (pixels.sampledPixels > 0) {
    out.push({ label: "Pixel statistics sampled", description: `Measured ${pixels.sampledPixels.toLocaleString()} pixels: high-frequency noise ${pixels.noise ?? "—"}, edge density ${pixels.edgeDensity ?? "—"}%.`, severity: "low", impact: "neutral" });
  }
  return out;
}

/* ------------------------------------------------------------------ API */

export async function inspectImage(file: File): Promise<ImageForensics> {
  const buffer = await file.arrayBuffer();
  const u8 = new Uint8Array(buffer);
  let format = "unknown";
  let meta: Meta = { ...EMPTY_META };
  let encoding: Encoding = { ...EMPTY_ENCODING };

  if (at(u8, 0) === 0xff && at(u8, 1) === 0xd8 && at(u8, 2) === 0xff) {
    format = "JPEG";
    ({ meta, encoding } = parseJpeg(u8));
  } else if (ascii(u8, 1, 3) === "PNG") {
    format = "PNG";
    ({ meta, encoding } = parsePng(u8));
  } else if (ascii(u8, 0, 4) === "RIFF" && ascii(u8, 8, 4) === "WEBP") {
    format = "WebP";
    ({ meta, encoding } = parseWebp(u8));
  }

  const pixels = await analyzePixels(file);
  let width = null, height = null;
  if (format === "PNG" && u8.length > 24) {
    width = ((at(u8, 16) << 24) | (at(u8, 17) << 16) | (at(u8, 18) << 8) | at(u8, 19)) >>> 0;
    height = ((at(u8, 20) << 24) | (at(u8, 21) << 16) | (at(u8, 22) << 8) | at(u8, 23)) >>> 0;
  }
  if (format === "JPEG") {
    for (let o = 2; o + 9 < u8.length && o < 262144; o++) {
      if (at(u8, o) === 0xff && [0xc0, 0xc1, 0xc2, 0xc3].includes(at(u8, o + 1))) {
        height = (at(u8, o + 5) << 8) | at(u8, o + 6);
        width = (at(u8, o + 7) << 8) | at(u8, o + 8);
        break;
      }
    }
  }

  const signals = buildSignals(meta, encoding, pixels);
  return {
    format,
    bytes: file.size,
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
    metadata: meta,
    encoding,
    pixels,
    signals,
    score: scoreSignals(signals),
  };
}

export function imageToResult(f: ImageForensics, fileName: string): MediaAnalysisResult {
  const strongNegative = f.signals.some((s) => s.severity === "high" && s.impact === "negative");
  const level: AuthenticityLevel = strongNegative
    ? "manipulated"
    : f.score >= 68
      ? "authentic"
      : f.score >= 42
        ? "uncertain"
        : "manipulated";
  const labels: Record<AuthenticityLevel, string> = {
    authentic: "Likely authentic",
    uncertain: "Inconclusive",
    manipulated: "Needs scrutiny",
    unknown: "Not reported",
  };
  const dims = f.width && f.height ? `${f.width}×${f.height}px` : "dimensions unavailable";
  const lines = [
    `File: ${fileName} · ${f.format} · ${dims} · ${(f.bytes / 1024).toFixed(1)} KB`,
    `Encoding: quality ${f.encoding.quality ?? "n/a"} · sampling ${f.encoding.sampling ?? "n/a"} · ${f.encoding.progressive === null ? "progressive unknown" : f.encoding.progressive ? "progressive" : "baseline"} · trailing bytes ${f.encoding.trailingBytes}`,
    `Metadata: EXIF ${f.metadata.exif ? "present" : "absent"} · GPS ${f.metadata.gps ? "present" : "absent"} · Software ${f.metadata.software ?? "none"} · Camera ${f.metadata.camera ?? "none"}`,
    `Pixels: ${f.pixels.sampledPixels.toLocaleString()} sampled · noise ${f.pixels.noise ?? "n/a"} · flat-region noise ${f.pixels.flatNoise ?? "n/a"} · edges ${f.pixels.edgeDensity ?? "n/a"}%`,
    "",
    ...f.signals.map((s) => `• ${s.label}: ${s.description}`),
  ];
  const confidence = confidenceFor(f.signals.length);
  return {
    truthScore: f.score,
    authenticity: { level, label: labels[level] },
    indicators: toIndicators(f.signals),
    explanation: lines.join("\n"),
    confidence,
    uncertainty: uncertaintyFor(confidence),
    uncertaintyNote: "How much the score could change if more evidence were available.",
    modelVersion: "local-forensics-v1",
  };
}

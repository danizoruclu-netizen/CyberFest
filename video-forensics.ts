/**
 * Local video forensics: samples real frames in the browser and inspects the
 * container bytes. Returns the same VideoAnalysisResult shape as the backend,
 * but every number comes from measurements made locally.
 */
import type { SuspiciousFrame, TimelineSegment, VideoAnalysisResult } from "@/lib/video/video-analysis";
import { ascii, clamp, includesAscii } from "./forensics-shared";

type FrameStats = { t: number; mean: number; noise: number; edges: number; diff: number | null; gray: Float32Array | null };

function waitForEvent(el: HTMLVideoElement, name: string, timeoutMs: number, until?: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    if (until?.()) return resolve();
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(`Video ${name} failed`)); };
    const timer = setTimeout(() => {
      cleanup();
      // A browser can skip the event when the target time is already current;
      // if the condition is met we still treat the seek as successful.
      if (until?.()) resolve();
      else reject(new Error(`Video ${name} timed out`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(name, done);
      el.removeEventListener("error", fail);
    };
    el.addEventListener(name, done, { once: true });
    el.addEventListener("error", fail, { once: true });
  });
}

function measureFrame(video: HTMLVideoElement, width: number, height: number, previous: Float32Array | null): Omit<FrameStats, "t"> & { gray: Float32Array } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { mean: 0, noise: 0, edges: 0, diff: null, gray: new Float32Array(width * height) };
  ctx.drawImage(video, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    const v = 0.299 * (data[p] ?? 0) + 0.587 * (data[p + 1] ?? 0) + 0.114 * (data[p + 2] ?? 0);
    gray[i] = v;
    sum += v;
  }
  const px = (x: number, y: number) => gray[y * width + x] ?? 0;
  let noise = 0, edges = 0, n = 0, diff = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i] ?? 0;
      const d = Math.abs(v - (px(x - 1, y) + px(x + 1, y) + px(x, y - 1) + px(x, y + 1)) / 4);
      noise += d;
      if (d > 14) edges++;
      if (previous) diff += Math.abs(v - (previous[i] ?? 0));
      n++;
    }
  }
  return {
    mean: gray.length ? sum / gray.length : 0,
    noise: n ? Math.round((noise / n) * 100) / 100 : 0,
    edges: n ? Math.round((edges / n) * 1000) / 10 : 0,
    diff: previous && n ? Math.round((diff / n) * 100) / 100 : null,
    gray,
  };
}

async function inspectContainer(file: File) {
  const head = new Uint8Array(await file.slice(0, 196608).arrayBuffer());
  const tailStart = Math.max(0, file.size - 196608);
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const scan = `${ascii(head, 0, head.length)} ${ascii(tail, 0, tail.length)}`.toLowerCase();
  const generator = /lavf|ffmpeg|handbrake|obs studio|adobe premiere|after effects|davinci/i.test(scan);
  const camera = /iphone|canon|nikon|sony|samsung|gopro|dji|pixel|huawei|xiaomi/i.test(scan);
  const fastStart = includesAscii(head, "moov");
  const editList = scan.includes("elst");
  return { generator, camera, fastStart, editList };
}

export async function inspectVideo(
  file: File,
  opts: { onFrame?: (percent: number) => void } = {},
): Promise<VideoAnalysisResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForEvent(video, "loadedmetadata", 10000, () => video.readyState >= 1);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    const count = duration ? Math.min(12, Math.max(5, Math.round(duration * 1.5))) : 6;
    const frames: FrameStats[] = [];
    let lastGray: Float32Array | null = null;

    for (let i = 0; i < count; i++) {
      const t = duration ? ((i + 0.5) / count) * duration : i * 0.5;
      if (duration) {
        const target = clamp(t, 0, Math.max(0, duration - 0.05));
        const targetReached = () => Math.abs(video.currentTime - target) < 0.12;
        if (!targetReached()) {
          video.currentTime = target;
          await waitForEvent(video, "seeked", 5000, targetReached);
        }
      }
      const m = measureFrame(video, 224, 126, lastGray);
      frames.push({ t, mean: m.mean, noise: m.noise, edges: m.edges, diff: m.diff, gray: m.gray });
      lastGray = m.gray;
      opts.onFrame?.(Math.round(((i + 1) / count) * 100));
    }

    const container = await inspectContainer(file);
    const noises = frames.map((f) => f.noise).sort((a, b) => a - b);
    const medianNoise = noises[Math.floor(noises.length / 2)] ?? 2;
    const step = duration ? duration / count : 0.5;
    const suspiciousFrames: SuspiciousFrame[] = [];
    const timeline: TimelineSegment[] = [];

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!f) continue;
      const prev = i > 0 ? frames[i - 1] : undefined;
      const frozen = prev !== undefined && f.diff !== null && f.diff < 1.1;
      const cut = prev !== undefined && f.diff !== null && f.diff > 46;
      const spike = f.noise > Math.max(4, medianNoise * 2.1);
      const score = clamp(Math.round(8 + (frozen ? 64 : 0) + (cut ? 34 : 0) + (spike ? 28 : 0)), 0, 100);
      timeline.push({ start: Math.round((i * step) * 10) / 10, end: Math.round(((i + 1) * step) * 10) / 10, score });
      if (frozen) suspiciousFrames.push({ timestamp: Math.round(f.t * 10) / 10, score: 74, reason: "Near-identical to previous sample — possible freeze, loop or duplicated frames." });
      else if (cut) suspiciousFrames.push({ timestamp: Math.round(f.t * 10) / 10, score: 52, reason: "Abrupt frame change — hard cut or sudden content swap." });
      else if (spike) suspiciousFrames.push({ timestamp: Math.round(f.t * 10) / 10, score: 58, reason: `Noise level jumped to ${f.noise} (median ${medianNoise}) — possible merge or re-encode boundary.` });
    }

    const lines = [
      `Container: ${file.name} · ${(file.size / 1048576).toFixed(2)} MB · ${duration ? `${duration.toFixed(2)}s` : "duration unavailable"}`,
      `Decoded: ${video.videoWidth || "?"}×${video.videoHeight || "?"} · ${frames.length} frames sampled evenly across the clip`,
      `Container scan: generator/re-encoder signatures ${container.generator ? "FOUND" : "not found"} · camera signatures ${container.camera ? "found" : "not found"} · fast-start ${container.fastStart ? "yes" : "no"} · edit list ${container.editList ? "present" : "absent"}`,
      `Frame stats: median high-frequency noise ${medianNoise} · mean frame difference ${frames.length > 1 ? (frames.reduce((s, f) => s + (f.diff ?? 0), 0) / Math.max(1, frames.length - 1)).toFixed(2) : "n/a"}`,
      "",
      ...(container.generator ? ["• Re-encoding / editing software signature found in container metadata — this video has passed through a processing tool (not itself proof of manipulation)."] : []),
      ...(suspiciousFrames.length ? suspiciousFrames.map((f) => `• At ${f.timestamp.toFixed(1)}s: ${f.reason}`) : ["• No frozen, duplicated or noise-spiking frames were detected in the sampled set."]),
    ];

    return {
      verdict: suspiciousFrames.length >= 2 || (container.generator && suspiciousFrames.length >= 1) ? "manipulated" : "authentic",
      confidence: Math.round(clamp(58 + frames.length * 2, 50, 86)),
      durationSec: duration,
      framesAnalyzed: frames.length,
      suspiciousFrames,
      timeline,
      explanation: lines.join("\n"),
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

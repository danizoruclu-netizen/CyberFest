/**
 * Video Analysis module: upload rules, response parsing and the backend client.
 *   POST {VITE_TRUTHGUARD_API_URL}/analyze/video  (multipart "file", "mode"="frames")
 * No backend / unreachable → demo outcome with no result. Results are never simulated.
 */
import { formatBytes, MB } from "@/lib/deepfake/media-rules";
import { AnalysisCancelled, AnalysisError, getApiBaseUrl, type AnalysisPhase } from "@/lib/deepfake/api";

export const VIDEO_RULES = {
  extensions: ["mp4", "mov", "avi"],
  mimeTypes: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/avi", "video/msvideo"],
  maxBytes: 500 * MB,
};
export const VIDEO_FORMATS = ["MP4", "MOV", "AVI"];
export const VIDEO_ACCEPT = [...VIDEO_RULES.extensions.map((e) => `.${e}`), ...VIDEO_RULES.mimeTypes].join(",");

export function validateVideoFile(file: { name: string; type: string; size: number }): { ok: true } | { ok: false; error: string } {
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
  if (!VIDEO_RULES.extensions.includes(ext))
    return { ok: false, error: `Unsupported file type${ext ? ` (.${ext})` : ""}. Please upload ${VIDEO_FORMATS.join(", ")}.` };
  if (file.type && !VIDEO_RULES.mimeTypes.includes(file.type.toLowerCase()))
    return { ok: false, error: `This file says it is .${ext} but looks like "${file.type}". Please upload a genuine video.` };
  if (file.size <= 0) return { ok: false, error: "This file is empty. Please choose another one." };
  if (file.size > VIDEO_RULES.maxBytes)
    return { ok: false, error: `This video is ${formatBytes(file.size)}. The limit is ${formatBytes(VIDEO_RULES.maxBytes)}.` };
  return { ok: true };
}

export type SuspiciousFrame = { timestamp: number; score: number; reason: string };
export type TimelineSegment = { start: number; end: number; score: number };
export type VideoAnalysisResult = {
  verdict: "authentic" | "manipulated";
  confidence: number | null; // 0–100
  durationSec: number | null;
  framesAnalyzed: number | null;
  suspiciousFrames: SuspiciousFrame[];
  timeline: TimelineSegment[]; // score 0–100 = how suspicious
  explanation: string;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: unknown) => {
  const n = num(v);
  if (n === null || n < 0) return null;
  if (n <= 1) return Math.round(n * 100);
  return n <= 100 ? Math.round(n) : null;
};
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const pick = (o: Record<string, unknown>, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined);

/** Returns null unless the backend sent a clear verdict — no guessing. */
export function parseVideoResponse(body: unknown): VideoAnalysisResult | null {
  let o = rec(body);
  if (o["result"] && typeof o["result"] === "object") o = rec(o["result"]);
  const raw = String(pick(o, "verdict", "status") ?? "").toLowerCase();
  const verdict = raw.includes("manipul") || raw.includes("fake") ? "manipulated" : raw.includes("authentic") || raw.includes("real") ? "authentic" : null;
  if (!verdict) return null;
  const frames = (pick(o, "suspiciousFrames", "suspicious_frames") as unknown[] | undefined) ?? [];
  const timeline = (pick(o, "timeline") as unknown[] | undefined) ?? [];
  return {
    verdict,
    confidence: pct(o["confidence"]),
    durationSec: num(pick(o, "durationSec", "duration_sec", "duration")),
    framesAnalyzed: num(pick(o, "framesAnalyzed", "frames_analyzed")),
    suspiciousFrames: (Array.isArray(frames) ? frames : []).flatMap((f) => {
      const r = rec(f);
      const t = num(pick(r, "timestamp", "time"));
      const s = pct(r["score"]);
      return t === null || s === null ? [] : [{ timestamp: t, score: s, reason: String(r["reason"] ?? r["description"] ?? "") }];
    }),
    timeline: (Array.isArray(timeline) ? timeline : []).flatMap((seg) => {
      const r = rec(seg);
      const start = num(r["start"]);
      const end = num(r["end"]);
      const s = pct(r["score"]);
      return start === null || end === null || s === null || end < start ? [] : [{ start, end, score: s }];
    }),
    explanation: String(o["explanation"] ?? ""),
  };
}

export const formatTimestamp = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export type VideoOutcome =
  | { mode: "live"; result: VideoAnalysisResult }
  | { mode: "demo"; reason: "not_configured" | "unreachable"; detail?: string | undefined };

export function analyzeVideo(
  file: File,
  opts: { signal?: AbortSignal; onProgress?: (phase: AnalysisPhase, pct: number) => void } = {},
): Promise<VideoOutcome> {
  const base = getApiBaseUrl();
  if (!base) return Promise.resolve({ mode: "demo", reason: "not_configured" });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/analyze/video`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const p = Math.round((e.loaded / e.total) * 100);
        opts.onProgress?.(p >= 100 ? "analyzing" : "uploading", p);
      }
    };
    xhr.upload.onload = () => opts.onProgress?.("analyzing", 100);
    xhr.onerror = () => resolve({ mode: "demo", reason: "unreachable", detail: "The video analysis service could not be reached." });
    xhr.onabort = () => reject(new AnalysisCancelled("Analysis cancelled."));
    xhr.onload = () => {
      if ([404, 502, 503, 504].includes(xhr.status)) {
        resolve({ mode: "demo", reason: "unreachable", detail: `The video analysis service is unavailable (HTTP ${xhr.status}).` });
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) return reject(new AnalysisError(`The service rejected the video (HTTP ${xhr.status}).`));
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText); } catch { body = null; }
      const result = parseVideoResponse(body);
      if (!result) return reject(new AnalysisError("The service sent back a report TruthGuard couldn't read, so no result is shown."));
      resolve({ mode: "live", result });
    };
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("type", "video");
    form.append("mode", "frames");
    opts.onProgress?.("uploading", 0);
    xhr.send(form);
  });
}

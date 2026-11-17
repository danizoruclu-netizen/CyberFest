/**
 * Analysis dispatcher: use the configured backend when available, otherwise
 * run the local forensic analyzers. Both paths return a result, so the UI is
 * fully interactive in Demo Mode. The source is always reported honestly.
 */
import {
  AnalysisCancelled,
  analyzeMedia,
  getApiBaseUrl,
  type AnalysisPhase,
} from "@/lib/deepfake/api";
import type { MediaAnalysisResult } from "@/lib/deepfake/analysis-result";
import type { MediaKind } from "@/lib/deepfake/media-rules";
import { analyzeVideo, type VideoAnalysisResult } from "@/lib/video/video-analysis";
import type { UrlAnalysisResult } from "@/lib/url/url-analysis";
import { analyzeUrl } from "@/lib/url/url-analysis";
import { delay, isAbort } from "./forensics-shared";
import { imageToResult, inspectImage } from "./image-forensics";
import { inspectVideo } from "./video-forensics";
import { inspectUrl } from "./url-forensics";

export type AnalysisSource = "live" | "local";
export type WithSource<T> = { source: AnalysisSource; result: T; notice?: string | undefined };

type Opts = { signal?: AbortSignal; onProgress?: (phase: AnalysisPhase, percent: number) => void };

const backend = () => getApiBaseUrl().length > 0;

async function localSteps(opts: Opts, stages: AnalysisPhase[]) {
  opts.onProgress?.("preparing", 0);
  await delay(180, opts.signal);
  for (let i = 0; i < stages.length; i++) {
    const phase = stages[i];
    if (!phase) continue;
    opts.onProgress?.(phase, Math.round(((i + 1) / stages.length) * 100));
    await delay(140, opts.signal);
  }
}

function guard(err: unknown): never {
  if (isAbort(err)) throw new AnalysisCancelled("Analysis cancelled.");
  throw err;
}

export function videoToMediaResult(v: VideoAnalysisResult, fileName: string): MediaAnalysisResult {
  const level = v.verdict === "manipulated" ? "manipulated" : v.suspiciousFrames.length ? "uncertain" : "authentic";
  const score = v.verdict === "manipulated"
    ? Math.max(12, 58 - v.suspiciousFrames.length * 11)
    : Math.max(40, 88 - v.suspiciousFrames.length * 14);
  const labels = { authentic: "Likely authentic", uncertain: "Inconclusive", manipulated: "Needs scrutiny", unknown: "Not reported" };
  return {
    truthScore: Math.round(score),
    authenticity: { level, label: labels[level] },
    indicators: v.suspiciousFrames.map((f) => ({ label: `Frame at ${f.timestamp.toFixed(1)}s`, description: f.reason, severity: f.score >= 60 ? "high" : f.score >= 30 ? "medium" : "low" })),
    explanation: v.explanation,
    confidence: v.confidence,
    uncertainty: v.confidence === null ? null : Math.min(90, 112 - v.confidence),
    uncertaintyNote: "How much the score could change with a larger frame sample.",
    modelVersion: "local-frame-sampling-v1",
  };
}

export async function analyzeMediaWithFallback(file: File, kind: MediaKind, opts: Opts = {}): Promise<WithSource<MediaAnalysisResult>> {
  if (backend()) {
    try {
      const out = await analyzeMedia(file, kind, opts);
      if (out.mode === "live") return { source: "live", result: out.result };
    } catch (err) {
      if (isAbort(err)) throw new AnalysisCancelled("Analysis cancelled.");
      // A malformed backend reply falls through to the local check.
    }
  }
  try {
    await localSteps(opts, ["sampling", "analyzing"]);
    const result = kind === "image"
      ? imageToResult(await inspectImage(file), file.name)
      : videoToMediaResult(await inspectVideo(file, { onFrame: (p) => opts.onProgress?.("sampling", p) }), file.name);
    return {
      source: "local",
      result,
      ...(backend() ? { notice: "The detection service could not be used — local forensic checks were run instead." } : {}),
    };
  } catch (err) {
    guard(err);
  }
}

export async function analyzeVideoWithFallback(file: File, opts: Opts = {}): Promise<WithSource<VideoAnalysisResult>> {
  if (backend()) {
    try {
      const out = await analyzeVideo(file, opts);
      if (out.mode === "live") return { source: "live", result: out.result };
    } catch (err) {
      if (isAbort(err)) throw new AnalysisCancelled("Analysis cancelled.");
    }
  }
  try {
    await localSteps(opts, ["sampling", "analyzing"]);
    const result = await inspectVideo(file, { onFrame: (p) => opts.onProgress?.("sampling", p) });
    return {
      source: "local",
      result,
      ...(backend() ? { notice: "The detection service could not be used — local frame sampling was run instead." } : {}),
    };
  } catch (err) {
    guard(err);
  }
}

export async function analyzeUrlWithFallback(raw: string, normalized: string, hostname: string): Promise<WithSource<UrlAnalysisResult>> {
  if (backend()) {
    try {
      const out = await analyzeUrl(normalized);
      if (out.mode === "live") return { source: "live", result: out.result };
    } catch (err) {
      if (isAbort(err)) throw new AnalysisCancelled("Analysis cancelled.");
    }
  }
  await delay(220);
  return {
    source: "local",
    result: inspectUrl(raw, normalized, hostname),
    ...(backend() ? { notice: "The detection service could not be used — local URL checks were run instead." } : {}),
  };
}

/**
 * Scan records: both live backend results and measured local forensic results
 * are saved. Nothing is invented — every score comes from an actual analysis.
 */
import type { MediaAnalysisResult } from "@/lib/deepfake/analysis-result";
import type { VideoAnalysisResult } from "@/lib/video/video-analysis";
import { formatTimestamp } from "@/lib/video/video-analysis";
import type { UrlAnalysisResult } from "@/lib/url/url-analysis";

export type ScanType = "image" | "video" | "url";
export type ScanVerdict = "authentic" | "fake" | "suspicious";
export type ScanIndicator = { label: string; description: string; severity: "low" | "medium" | "high" | null };

export type ScanRecord = {
  id: string;
  type: ScanType;
  target: string; // file name or URL
  createdAt: string; // ISO
  verdict: ScanVerdict;
  confidence: number | null; // 0–100
  scoreLabel: string; // what `score` means
  score: number | null;
  summary: string;
  findings: string[];
  indicators: ScanIndicator[];
  recommendations: string[];
  source?: "live" | "local";
};

export const TYPE_LABEL: Record<ScanType, string> = { image: "Image", video: "Video", url: "URL" };
export const VERDICT_LABEL: Record<ScanVerdict, string> = { authentic: "Authentic", fake: "Potentially Fake", suspicious: "Suspicious" };

const RECS: Record<ScanType, Record<ScanVerdict, string[]>> = {
  image: {
    authentic: ["No strong signs of manipulation were found, but still check where the image first appeared.", "Use a reverse image search to confirm the original source and date."],
    suspicious: ["Don't share this image until you've confirmed its source.", "Look for the same image from a trusted outlet or the original photographer.", "Check for mismatched lighting, edges or text in the picture."],
    fake: ["Do not share this image as genuine.", "If it is spreading, report it to the platform where you found it.", "Look for an official statement or trusted fact-check before believing it."],
  },
  video: {
    authentic: ["No strong signs of manipulation were found, but confirm who first published the video.", "Compare with other recordings of the same event if available."],
    suspicious: ["Re-watch the flagged moments carefully before sharing.", "Look for the full, original upload from the official source.", "Check whether trusted news outlets have covered the same footage."],
    fake: ["Do not share this video as genuine.", "Report it to the platform where you found it.", "Look for an official statement or fact-check about the person shown."],
  },
  url: {
    authentic: ["The site looks low-risk, but always check the address before entering passwords.", "Keep your browser and security software up to date."],
    suspicious: ["Avoid entering passwords, card details or personal information on this site.", "Go to the organisation's official website by typing its address yourself.", "Do not download files from this site."],
    fake: ["Do not open or share this link.", "Never enter login or payment details on this site.", "If you already entered details, change your password and contact your bank."],
  },
};

export const recommendationsFor = (type: ScanType, verdict: ScanVerdict) => RECS[type][verdict];

const newId = () => {
  const c = globalThis.crypto;
  const raw = c?.randomUUID ? c.randomUUID().replace(/-/g, "") : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `TG-${raw.slice(0, 10).toUpperCase()}`;
};

function base(type: ScanType, target: string, verdict: ScanVerdict) {
  return { id: newId(), type, target, createdAt: new Date().toISOString(), verdict, recommendations: recommendationsFor(type, verdict) };
}

export function recordFromMedia(kind: "image" | "video", fileName: string, r: MediaAnalysisResult, source: "live" | "local" = "live"): ScanRecord {
  const lvl = r.authenticity.level;
  const verdict: ScanVerdict = lvl === "authentic" ? "authentic" : lvl === "manipulated" ? "fake" : "suspicious";
  return {
    ...base(kind, fileName, verdict),
    source,
    confidence: r.confidence,
    scoreLabel: "TruthScore",
    score: r.truthScore,
    summary: r.explanation ?? r.authenticity.label,
    findings: [
      `TruthScore: ${r.truthScore}/100 (${r.authenticity.label})`,
      `Uncertainty: ${r.uncertainty === null ? "not reported" : `${r.uncertainty}%`}`,
      ...(r.modelVersion ? [`Detection model: ${r.modelVersion}`] : []),
    ],
    indicators: r.indicators.map((i) => ({ label: i.label, description: i.description ?? "", severity: i.severity ?? null })),
  };
}

export function recordFromVideo(fileName: string, r: VideoAnalysisResult, source: "live" | "local" = "live"): ScanRecord {
  const verdict: ScanVerdict = r.verdict === "manipulated" ? "fake" : r.suspiciousFrames.length > 0 ? "suspicious" : "authentic";
  return {
    ...base("video", fileName, verdict),
    source,
    confidence: r.confidence,
    scoreLabel: "Suspicious frames",
    score: r.suspiciousFrames.length,
    summary: r.explanation || (r.verdict === "manipulated" ? "The video shows signs of manipulation." : "No clear signs of manipulation were reported."),
    findings: [
      ...(r.durationSec !== null ? [`Duration: ${formatTimestamp(r.durationSec)}`] : []),
      ...(r.framesAnalyzed !== null ? [`Frames analysed: ${r.framesAnalyzed}`] : []),
      `Suspicious frames: ${r.suspiciousFrames.length}`,
      `Timeline segments reported: ${r.timeline.length}`,
    ],
    indicators: r.suspiciousFrames.map((f) => ({
      label: `Frame at ${formatTimestamp(f.timestamp)} (${f.score}%)`,
      description: f.reason,
      severity: f.score >= 60 ? "high" : f.score >= 30 ? "medium" : "low",
    })),
  };
}

export function recordFromUrl(url: string, r: UrlAnalysisResult, source: "live" | "local" = "live"): ScanRecord {
  const verdict: ScanVerdict = r.risk === "low" ? "authentic" : r.risk === "high" ? "fake" : "suspicious";
  const d = r.domain;
  return {
    ...base("url", url, verdict),
    source,
    confidence: null,
    scoreLabel: "Trust score",
    score: r.trustScore,
    summary: r.summary || `Final risk assessment: ${r.risk} risk.`,
    findings: [
      `Trust score: ${r.trustScore}/100 · ${r.risk} risk`,
      `Domain: ${d.name ?? "not reported"}${d.registrar ? ` · Registrar: ${d.registrar}` : ""}`,
      `Domain age: ${d.ageDays === null ? "not reported" : `${d.ageDays} days`} · HTTPS: ${d.https === null ? "not reported" : d.https ? "yes" : "no"}`,
      `Redirects: ${r.redirects.length ? r.redirects.join(" → ") : "none detected"}`,
    ],
    indicators: [...r.phishingIndicators, ...r.warnings].map((f) => ({ label: f.label, description: f.description, severity: f.severity })),
  };
}

export type HistoryQuery = { q: string; type: ScanType | "all"; verdict: ScanVerdict | "all"; sort: "newest" | "oldest" };

export function filterScans(list: ScanRecord[], { q, type, verdict, sort }: HistoryQuery) {
  const needle = q.trim().toLowerCase();
  return list
    .filter((s) => (type === "all" || s.type === type) && (verdict === "all" || s.verdict === verdict))
    .filter((s) => !needle || s.target.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle))
    .sort((a, b) => (sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
}

export function scanStats(list: ScanRecord[]) {
  return {
    total: list.length,
    authentic: list.filter((s) => s.verdict === "authentic").length,
    fake: list.filter((s) => s.verdict === "fake").length,
    suspicious: list.filter((s) => s.verdict === "suspicious").length,
  };
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

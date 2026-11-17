/**
 * Shape of a media analysis report and a strict reader for backend responses.
 * Nothing here invents values: missing optional fields stay null and are shown as "Not reported".
 */
export type AuthenticityLevel = "authentic" | "uncertain" | "manipulated" | "unknown";
export type IndicatorSeverity = "low" | "medium" | "high";

export type SuspiciousIndicator = {
  label: string;
  description: string | null;
  severity: IndicatorSeverity | null;
};

export type MediaAnalysisResult = {
  truthScore: number; // 0–100
  authenticity: { level: AuthenticityLevel; label: string };
  indicators: SuspiciousIndicator[];
  explanation: string | null;
  confidence: number | null; // 0–100
  uncertainty: number | null; // 0–100
  uncertaintyNote: string | null;
  modelVersion: string | null;
};

type Raw = Record<string, unknown>;

const pick = (obj: Raw, ...keys: string[]) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
};

/** Accepts 0–1 fractions or 0–100 percentages; anything else is rejected. */
function toPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 1000) / 10;
  if (value > 1 && value <= 100) return Math.round(value * 10) / 10;
  return null;
}

const AUTHENTIC = ["authentic", "likely_authentic", "real", "genuine", "original"];
const MANIPULATED = ["manipulated", "likely_manipulated", "fake", "deepfake", "synthetic", "ai_generated", "edited"];
const UNCERTAIN = ["uncertain", "inconclusive", "suspicious", "unverified", "needs_review"];

const LEVEL_LABEL: Record<AuthenticityLevel, string> = {
  authentic: "Likely authentic",
  uncertain: "Inconclusive",
  manipulated: "Likely manipulated",
  unknown: "Not reported",
};

function readAuthenticity(value: unknown): MediaAnalysisResult["authenticity"] {
  if (typeof value !== "string" || !value.trim()) return { level: "unknown", label: LEVEL_LABEL.unknown };
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const level: AuthenticityLevel = AUTHENTIC.includes(key)
    ? "authentic"
    : MANIPULATED.includes(key)
      ? "manipulated"
      : UNCERTAIN.includes(key)
        ? "uncertain"
        : "unknown";
  return { level, label: level === "unknown" ? value.trim() : LEVEL_LABEL[level] };
}

function readSeverity(value: unknown): IndicatorSeverity | null {
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "low" || v === "medium" || v === "high") return v;
  }
  if (typeof value === "number") {
    const p = toPercent(value);
    if (p === null) return null;
    return p >= 70 ? "high" : p >= 40 ? "medium" : "low";
  }
  return null;
}

function readIndicators(value: unknown): SuspiciousIndicator[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SuspiciousIndicator[] => {
    if (typeof item === "string" && item.trim()) return [{ label: item.trim(), description: null, severity: null }];
    if (item && typeof item === "object") {
      const o = item as Raw;
      const label = pick(o, "label", "name", "title", "type");
      if (typeof label !== "string" || !label.trim()) return [];
      const description = pick(o, "description", "detail", "details", "explanation");
      return [
        {
          label: label.trim(),
          description: typeof description === "string" && description.trim() ? description.trim() : null,
          severity: readSeverity(pick(o, "severity", "level", "score")),
        },
      ];
    }
    return [];
  });
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Reads a backend response. Returns null when the required TruthScore is missing or out of range,
 * so the UI can show an honest error instead of a guessed result.
 */
export function parseAnalysisResponse(body: unknown): MediaAnalysisResult | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Raw;
  const data = (root["result"] && typeof root["result"] === "object" ? root["result"] : root) as Raw;

  const score = pick(data, "truthScore", "truth_score", "score");
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) return null;

  const uncertaintyRaw = pick(data, "uncertainty", "uncertainty_score");

  return {
    truthScore: Math.round(score),
    authenticity: readAuthenticity(pick(data, "authenticityStatus", "authenticity_status", "status", "verdict")),
    indicators: readIndicators(pick(data, "suspiciousIndicators", "suspicious_indicators", "indicators")),
    explanation: str(pick(data, "explanation", "detailedExplanation", "detailed_explanation", "summary")),
    confidence: toPercent(pick(data, "confidence", "confidence_score")),
    uncertainty: toPercent(uncertaintyRaw),
    uncertaintyNote: typeof uncertaintyRaw === "string" ? str(uncertaintyRaw) : str(pick(data, "uncertaintyNote", "uncertainty_note", "limitations")),
    modelVersion: str(pick(data, "modelVersion", "model_version", "model")),
  };
}

export type ScoreBand = "high" | "medium" | "low";
export function scoreBand(score: number): ScoreBand {
  return score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

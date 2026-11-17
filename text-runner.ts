/**
 * Text analysis dispatcher. Uses the backend's /analyze/text when configured,
 * otherwise falls back to the local heuristics. Both paths return measured data.
 */
import { getApiBaseUrl } from "@/lib/deepfake/api";
import { inspectText, type TextAnalysisResult, type TextVerdict } from "./text-forensics";

const VERDICTS: TextVerdict[] = ["likely_reliable", "mixed", "high_risk"];

function parseTextResponse(body: unknown): TextAnalysisResult | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const r = (o["result"] && typeof o["result"] === "object" ? o["result"] : o) as Record<string, unknown>;
  if (typeof r["credibilityScore"] !== "number" || !Number.isFinite(r["credibilityScore"])) return null;
  if (!VERDICTS.includes(r["verdict"] as TextVerdict)) return null;
  const stats = (r["stats"] && typeof r["stats"] === "object" ? r["stats"] : {}) as Record<string, unknown>;
  return {
    credibilityScore: Math.round(r["credibilityScore"] as number),
    verdict: r["verdict"] as TextVerdict,
    signals: Array.isArray(r["signals"]) ? (r["signals"] as Record<string, unknown>[]).flatMap((s) => {
      const label = s["label"];
      if (typeof label !== "string" || !label.trim()) return [];
      const sev = s["severity"];
      return [{
        label: label.trim(),
        description: typeof s["description"] === "string" ? s["description"] : "",
        severity: sev === "high" || sev === "medium" ? sev : "low" as const,
      }];
    }) : [],
    stats: {
      words: Number(stats["words"]) || 0,
      sentences: Number(stats["sentences"]) || 0,
      uppercaseRatio: Number(stats["uppercaseRatio"]) || 0,
      exclamations: Number(stats["exclamations"]) || 0,
      questions: Number(stats["questions"]) || 0,
      sourceMentions: Number(stats["sourceMentions"]) || 0,
    },
    summary: typeof r["summary"] === "string" ? r["summary"] : "",
    linkFindings: Array.isArray(r["linkFindings"]) ? (r["linkFindings"] as Record<string, unknown>[]).flatMap((f) => {
      const label = f["label"];
      if (typeof label !== "string") return [];
      const sev = f["severity"];
      return [{ label, description: typeof f["description"] === "string" ? f["description"] : "", severity: sev === "high" || sev === "medium" ? sev : "low" as const }];
    }) : [],
  };
}

export async function analyzeTextWithFallback(text: string, url?: string | undefined): Promise<TextAnalysisResult> {
  const base = getApiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ text, ...(url ? { url } : {}) }),
      });
      if (res.ok) {
        const parsed = parseTextResponse(await res.json().catch(() => null));
        if (parsed) return parsed;
      }
    } catch {
      // Backend unavailable — fall through to local heuristics.
    }
  }
  return inspectText(text, url);
}

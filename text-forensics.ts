/**
 * Local text heuristics for headlines, claims and articles. Measures wording,
 * sourcing and structure. This cannot verify whether a claim is factually true;
 * it only flags patterns commonly associated with misleading content.
 */
import type { UrlFinding } from "@/lib/url/url-analysis";
import { clamp, scoreSignals, type ForensicSignal } from "./forensics-shared";
import { inspectUrl } from "./url-forensics";

export type TextVerdict = "likely_reliable" | "mixed" | "high_risk";

export type TextAnalysisResult = {
  credibilityScore: number;
  verdict: TextVerdict;
  signals: UrlFinding[];
  stats: {
    words: number;
    sentences: number;
    uppercaseRatio: number;
    exclamations: number;
    questions: number;
    sourceMentions: number;
  };
  summary: string;
  linkFindings: UrlFinding[];
};

const CLICKBAIT = [
  "you won't believe", "shocking", "breaking", "urgent", "they don't want you to know",
  "secret", "exposed", "leaked", "100%", "guaranteed", "miracle", "banned",
  "what happens next", "nobody is talking about", "must see", "act now", "before it's too late",
];
const EMOTIONAL = ["outrageous", "terrifying", "amazing", "disgusting", "evil", "corrupt", "traitor", "hero", "catastrophe", "scam", "war", "collapse", "shocking", "secret"];
const ABSOLUTES = ["always", "never", "everyone", "nobody", "all of", "proven", "definitely", "completely", "totally"];
const SOURCE = /\b(according to|said|reported by|study|research|published|source|official|data from|survey|statement|document)/gi;

const toFinding = (s: ForensicSignal): UrlFinding => ({ label: s.label, description: s.description, severity: s.severity });

export function inspectText(text: string, articleUrl?: string | undefined): TextAnalysisResult {
  const clean = text.trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean) : [];
  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 3);
  const longWords = words.filter((w) => /[A-Za-z]{3,}/.test(w));
  const caps = longWords.filter((w) => w === w.toUpperCase()).length;
  const uppercaseRatio = longWords.length ? Math.round((caps / longWords.length) * 100) : 0;
  const exclamations = (clean.match(/!/g) ?? []).length;
  const questions = (clean.match(/\?/g) ?? []).length;
  const sourceMentions = (clean.match(SOURCE) ?? []).length;
  const lower = clean.toLowerCase();
  const signals: ForensicSignal[] = [];

  if (words.length < 12) {
    signals.push({ label: "Very short text", description: `Only ${words.length} words were supplied — too little context to assess claims or sourcing.`, severity: "medium", impact: "negative" });
  } else {
    signals.push({ label: "Enough text to inspect", description: `${words.length} words across ${sentences.length} sentence(s) were analysed.`, severity: "low", impact: "positive" });
  }

  const bait = CLICKBAIT.filter((p) => lower.includes(p));
  if (bait.length) {
    signals.push({ label: "Clickbait / urgency wording", description: `Found: ${bait.slice(0, 4).join(", ")}. These phrases are designed to provoke a click rather than inform.`, severity: "high", impact: "negative" });
  }
  if (uppercaseRatio >= 30 && longWords.length >= 5) {
    signals.push({ label: "Excessive capital letters", description: `${uppercaseRatio}% of words are in ALL CAPS — often used to simulate urgency.`, severity: "medium", impact: "negative" });
  }
  if (exclamations >= 3) {
    signals.push({ label: "Excessive punctuation", description: `${exclamations} exclamation marks in ${words.length} words.`, severity: exclamations >= 4 ? "medium" : "low", impact: "negative" });
  }
  const emotional = EMOTIONAL.filter((w) => lower.includes(w));
  if (emotional.length >= 2) {
    signals.push({ label: "Emotionally charged language", description: `Found: ${emotional.slice(0, 4).join(", ")}. Emotional framing can replace evidence.`, severity: "medium", impact: "negative" });
  }
  const absolutes = ABSOLUTES.filter((w) => lower.includes(w));
  if (absolutes.length >= 2) {
    signals.push({ label: "Absolute claims", description: `Found: ${absolutes.slice(0, 4).join(", ")}. Verifiable claims usually carry qualifiers and evidence.`, severity: "low", impact: "negative" });
  }
  if (words.length >= 25 && sourceMentions === 0) {
    signals.push({ label: "No source or attribution", description: "No 'according to', 'said', 'study', 'official' or similar attribution was found in a text of this length.", severity: "medium", impact: "negative" });
  } else if (sourceMentions > 0) {
    signals.push({ label: "Source language present", description: `${sourceMentions} attribution phrase(s) found — a positive signal, though the sources still need checking.`, severity: "low", impact: "positive" });
  }
  if (/\b\d+(\.\d+)?\s*(%|percent|million|billion|people|cases|dead)\b/i.test(clean) && sourceMentions === 0) {
    signals.push({ label: "Unsourced numeric claim", description: "Specific figures appear without any attribution in the text.", severity: "low", impact: "negative" });
  }
  if (words.length > 25) {
    const freq = new Map<string, number>();
    for (const w of words) {
      const k = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (k.length > 3) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    const repeated = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    if (repeated && repeated[1] >= 5) {
      signals.push({ label: "Heavy repetition", description: `"${repeated[0]}" appears ${repeated[1]} times — common in coordinated or low-effort messaging.`, severity: "low", impact: "negative" });
    }
  }
  if (questions >= 2 && words.length < 40) {
    signals.push({ label: "Rhetorical question headline", description: "Multiple question marks in a short text are a common curiosity-gap headline pattern.", severity: "low", impact: "negative" });
  }

  let linkFindings: UrlFinding[] = [];
  if (articleUrl?.trim()) {
    const raw = articleUrl.trim();
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    try {
      const u = new URL(hasScheme ? raw : `https://${raw}`);
      linkFindings = inspectUrl(raw, u.toString(), u.hostname).warnings;
      signals.push({ label: "Article link checked structurally", description: `${linkFindings.length} URL-level observations recorded separately.`, severity: "low", impact: "neutral" });
    } catch {
      signals.push({ label: "Article link could not be parsed", description: "The link was not analysed.", severity: "low", impact: "negative" });
    }
  }

  const credibilityScore = Math.round(clamp(scoreSignals(signals, 82), 6, 96));
  const verdict: TextVerdict = credibilityScore >= 70 ? "likely_reliable" : credibilityScore >= 45 ? "mixed" : "high_risk";
  const summary = [
    `${words.length} words and ${sentences.length} sentence(s) analysed; ${signals.length} signals measured.`,
    ...signals.map((s) => `• ${s.label}: ${s.description}`),
  ].join("\n");

  return {
    credibilityScore,
    verdict,
    signals: signals.map(toFinding),
    stats: { words: words.length, sentences: sentences.length, uppercaseRatio, exclamations, questions, sourceMentions },
    summary,
    linkFindings,
  };
}

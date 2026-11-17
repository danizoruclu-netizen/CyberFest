/**
 * Shared helpers for the local (no-backend) forensic analyzers.
 *
 * These analyzers measure real properties of the input (file bytes, metadata,
 * decoded pixels, URL structure, text statistics). They are deliberately
 * labelled as heuristics: they are NOT a trained deepfake classifier and must
 * never be presented as one.
 */
import type { IndicatorSeverity, SuspiciousIndicator } from "@/lib/deepfake/analysis-result";

export type SignalImpact = "positive" | "negative" | "neutral";

export type ForensicSignal = {
  label: string;
  description: string;
  severity: IndicatorSeverity;
  impact: SignalImpact;
};

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const at = (a: Uint8Array, i: number) => a[i] ?? 0;

export function ascii(bytes: Uint8Array, start: number, length: number) {
  let out = "";
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) out += String.fromCharCode(at(bytes, i));
  return out;
}

export function includesAscii(bytes: Uint8Array, needle: string) {
  const hay = ascii(bytes, 0, bytes.length).toLowerCase();
  return hay.includes(needle.toLowerCase());
}

/** Deterministic score from measured signals. Higher = more trustworthy. */
export function scoreSignals(signals: ForensicSignal[], base = 72) {
  let score = base;
  for (const s of signals) {
    const weight = s.severity === "high" ? 26 : s.severity === "medium" ? 11 : 4;
    score += s.impact === "negative" ? -weight : s.impact === "positive" ? weight : 0;
  }
  return Math.round(clamp(score, 6, 96));
}

export function toIndicators(signals: ForensicSignal[]): SuspiciousIndicator[] {
  return signals.map((s) => ({ label: s.label, description: s.description, severity: s.severity }));
}

/** Number of signals determines how much evidence we actually had. */
export function confidenceFor(signalCount: number, cap = 86) {
  return Math.round(clamp(56 + signalCount * 5, 50, cap));
}

export function uncertaintyFor(confidence: number) {
  return Math.round(clamp(112 - confidence, 30, 90));
}

export function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

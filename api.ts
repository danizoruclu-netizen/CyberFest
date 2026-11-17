/**
 * Client for the TRUTHGUARD detection backend.
 *   POST {VITE_TRUTHGUARD_API_URL}/analyze/image   (multipart field "file")
 *   POST {VITE_TRUTHGUARD_API_URL}/analyze/video   (multipart field "file")
 * When no backend address is set, or it can't be reached, callers use the
 * local forensic dispatcher in `lib/local/local-runner.ts` so the UI still
 * produces measured results in Demo Mode.
 */
import { parseAnalysisResponse, type MediaAnalysisResult } from "./analysis-result";
import type { MediaKind } from "./media-rules";

export function getApiBaseUrl() {
  const raw = (import.meta.env["VITE_TRUTHGUARD_API_URL"] as string | undefined) ?? "";
  return raw.trim().replace(/\/+$/, "");
}

export const isBackendConfigured = () => getApiBaseUrl().length > 0;

export type AnalysisPhase = "uploading" | "analyzing" | "preparing" | "sampling";

export type AnalyzeOutcome =
  | { mode: "live"; result: MediaAnalysisResult }
  | { mode: "demo"; reason: "not_configured" | "unreachable"; detail?: string | undefined };

export class AnalysisError extends Error {}
export class AnalysisCancelled extends Error {}

const UNAVAILABLE_STATUSES = new Set([404, 502, 503, 504]);

export function analyzeMedia(
  file: File,
  kind: MediaKind,
  opts: { signal?: AbortSignal; onProgress?: (phase: AnalysisPhase, uploadPercent: number) => void } = {},
): Promise<AnalyzeOutcome> {
  const base = getApiBaseUrl();
  if (!base) return Promise.resolve({ mode: "demo", reason: "not_configured" });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/analyze/${kind}`);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        opts.onProgress?.(pct >= 100 ? "analyzing" : "uploading", pct);
      }
    };
    xhr.upload.onload = () => opts.onProgress?.("analyzing", 100);

    xhr.onerror = () =>
      resolve({ mode: "demo", reason: "unreachable", detail: "The detection service could not be reached." });
    xhr.onabort = () => reject(new AnalysisCancelled("Analysis cancelled."));

    xhr.onload = () => {
      if (UNAVAILABLE_STATUSES.has(xhr.status)) {
        resolve({ mode: "demo", reason: "unreachable", detail: `The detection service is unavailable (HTTP ${xhr.status}).` });
        return;
      }
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const msg =
          body && typeof body === "object" && typeof (body as Record<string, unknown>)["message"] === "string"
            ? ((body as Record<string, unknown>)["message"] as string)
            : `The detection service rejected the file (HTTP ${xhr.status}).`;
        reject(new AnalysisError(msg));
        return;
      }
      const result = parseAnalysisResponse(body);
      if (!result) {
        reject(new AnalysisError("The detection service sent back a report TruthGuard couldn't read, so no result is shown."));
        return;
      }
      resolve({ mode: "live", result });
    };

    if (opts.signal) {
      if (opts.signal.aborted) return reject(new AnalysisCancelled("Analysis cancelled."));
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("type", kind);
    opts.onProgress?.("uploading", 0);
    xhr.send(form);
  });
}

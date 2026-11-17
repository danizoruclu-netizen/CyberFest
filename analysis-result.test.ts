import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "../analysis-result";

describe("parseAnalysisResponse", () => {
  it("returns null when TruthScore is missing, so nothing is guessed", () => {
    expect(parseAnalysisResponse({ status: "authentic" })).toBeNull();
  });

  it("rejects a TruthScore outside 0–100", () => {
    expect(parseAnalysisResponse({ truth_score: 101 })).toBeNull();
    expect(parseAnalysisResponse({ truth_score: -1 })).toBeNull();
  });

  it("reads a full snake_case response", () => {
    const r = parseAnalysisResponse({
      truth_score: 23,
      authenticity_status: "likely_manipulated",
      suspicious_indicators: [{ label: "Face boundary blending", severity: "high" }],
      explanation: "Edges around the jaw are inconsistent.",
      confidence: 0.82,
      uncertainty: 0.18,
    });
    expect(r?.truthScore).toBe(23);
    expect(r?.authenticity.level).toBe("manipulated");
    expect(r?.indicators[0]).toEqual({ label: "Face boundary blending", description: null, severity: "high" });
    expect(r?.confidence).toBe(82);
    expect(r?.uncertainty).toBe(18);
  });

  it("leaves unreported confidence and uncertainty empty instead of inventing them", () => {
    const r = parseAnalysisResponse({ truthScore: 90 });
    expect(r?.confidence).toBeNull();
    expect(r?.uncertainty).toBeNull();
    expect(r?.authenticity.level).toBe("unknown");
  });
});

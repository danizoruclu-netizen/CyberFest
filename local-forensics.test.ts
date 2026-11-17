import { describe, expect, it } from "vitest";
import { inspectUrl } from "../url-forensics";
import { inspectText } from "../text-forensics";
import { scoreSignals, clamp } from "../forensics-shared";

describe("local URL forensics", () => {
  it("flags a lookalike domain, HTTP, and abused TLD without network calls", () => {
    const r = inspectUrl("http://paypa1-secure-login.tk/verify", "http://paypa1-secure-login.tk/verify", "paypa1-secure-login.tk");
    expect(r.domain.https).toBe(false);
    expect(r.trustScore).toBeLessThan(50);
    expect(r.risk).toBe("high");
    expect(r.phishingIndicators.some((f) => /paypal/i.test(f.label))).toBe(true);
    expect(r.phishingIndicators.some((f) => /HTTP|Unencrypted/i.test(f.label))).toBe(true);
    expect(r.redirects).toEqual([]);
    expect(r.domain.registrar).toBeNull();
    expect(r.domain.ageDays).toBeNull();
  });

  it("scores a plain HTTPS domain higher than a suspicious one", () => {
    const good = inspectUrl("https://example.com", "https://example.com/", "example.com");
    const bad = inspectUrl("http://paypa1-login.tk/verify", "http://paypa1-login.tk/verify", "paypa1-login.tk");
    expect(good.trustScore).toBeGreaterThan(bad.trustScore);
  });

  it("detects punycode / non-ASCII domains", () => {
    const r = inspectUrl("https://xn--pple-43d.com", "https://xn--pple-43d.com/", "xn--pple-43d.com");
    expect(r.phishingIndicators.some((f) => /Internationalised|encoded/i.test(f.label))).toBe(true);
  });
});

describe("local text forensics", () => {
  it("flags clickbait and urgency language", () => {
    const r = inspectText("BREAKING!!! You won't believe this SHOCKING secret that EVERYONE must see right now!!!");
    expect(r.verdict).toBe("high_risk");
    expect(r.signals.some((s) => /Clickbait/i.test(s.label))).toBe(true);
    expect(r.credibilityScore).toBeLessThan(50);
  });

  it("treats attributed, measured text more favourably", () => {
    const r = inspectText("According to the official report published by the ministry, the survey of 2,000 people found that reading improved during the year. The study was reported by several outlets and the data is available in the statement.");
    expect(r.stats.sourceMentions).toBeGreaterThan(0);
    expect(r.verdict).not.toBe("high_risk");
  });

  it("reports measured statistics", () => {
    const r = inspectText("One two three. Four five six!");
    expect(r.stats.words).toBe(6);
    expect(r.stats.sentences).toBe(2);
    expect(r.stats.exclamations).toBe(1);
  });
});

describe("scoring helpers", () => {
  it("clamps and subtracts negative signals", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    const signals = [
      { label: "a", description: "", severity: "high" as const, impact: "negative" as const },
      { label: "b", description: "", severity: "medium" as const, impact: "positive" as const },
    ];
    expect(scoreSignals(signals, 70)).toBe(55); // 70 - 26 + 11
  });
});

import { describe, expect, it } from "vitest";
import { filterScans, recordFromUrl, scanStats, type ScanRecord } from "../scan-record";

const rec = (id: string, type: ScanRecord["type"], verdict: ScanRecord["verdict"], createdAt: string, target = id): ScanRecord => ({
  id, type, verdict, createdAt, target, confidence: 80, score: 50, scoreLabel: "x", summary: "", findings: [], indicators: [], recommendations: [],
});
const list = [rec("a", "image", "authentic", "2026-01-01", "cat.jpg"), rec("b", "url", "fake", "2026-03-01", "https://bad.test"), rec("c", "video", "suspicious", "2026-02-01", "clip.mp4")];
const all = { q: "", type: "all", verdict: "all", sort: "newest" } as const;

describe("filterScans", () => {
  it("sorts newest first", () => expect(filterScans(list, all).map((s) => s.id)).toEqual(["b", "c", "a"]));
  it("sorts oldest first", () => expect(filterScans(list, { ...all, sort: "oldest" }).map((s) => s.id)).toEqual(["a", "c", "b"]));
  it("filters by type", () => expect(filterScans(list, { ...all, type: "video" }).map((s) => s.id)).toEqual(["c"]));
  it("filters by result", () => expect(filterScans(list, { ...all, verdict: "fake" }).map((s) => s.id)).toEqual(["b"]));
  it("searches name or URL", () => expect(filterScans(list, { ...all, q: "BAD" }).map((s) => s.id)).toEqual(["b"]));
});

describe("scanStats", () => {
  it("counts verdicts", () => expect(scanStats(list)).toEqual({ total: 3, authentic: 1, fake: 1, suspicious: 1 }));
});

describe("recordFromUrl", () => {
  it("maps high risk to Potentially Fake", () => {
    const r = recordFromUrl("https://x.test/", { trustScore: 10, risk: "high", phishingIndicators: [], warnings: [], domain: { name: null, registrar: null, ageDays: null, country: null, https: null }, redirects: [], summary: "" });
    expect(r.verdict).toBe("fake");
    expect(r.id).toMatch(/^TG-[0-9A-F]{10}$/);
  });
});

import { describe, expect, it } from "vitest";
import { parseVideoResponse, validateVideoFile } from "../video-analysis";

describe("validateVideoFile", () => {
  it("accepts AVI", () => expect(validateVideoFile({ name: "a.avi", type: "video/x-msvideo", size: 10 }).ok).toBe(true));
  it("accepts MOV", () => expect(validateVideoFile({ name: "a.mov", type: "video/quicktime", size: 10 }).ok).toBe(true));
  it("rejects images", () => expect(validateVideoFile({ name: "a.png", type: "image/png", size: 10 }).ok).toBe(false));
  it("rejects over 500 MB", () => expect(validateVideoFile({ name: "a.mp4", type: "video/mp4", size: 501 * 1024 * 1024 }).ok).toBe(false));
});

describe("parseVideoResponse", () => {
  it("returns null without a verdict", () => expect(parseVideoResponse({ confidence: 0.9 })).toBeNull());
  it("reads frames and timeline", () => {
    const r = parseVideoResponse({ verdict: "potentially_manipulated", confidence: 0.82, suspicious_frames: [{ timestamp: 4, score: 0.9, reason: "x" }], timeline: [{ start: 0, end: 5, score: 70 }] });
    expect(r?.verdict).toBe("manipulated");
    expect(r?.confidence).toBe(82);
    expect(r?.suspiciousFrames[0]?.score).toBe(90);
    expect(r?.timeline).toHaveLength(1);
  });
});

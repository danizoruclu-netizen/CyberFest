import { describe, expect, it } from "vitest";
import { MB, validateMediaFile } from "../media-rules";

const f = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("validateMediaFile", () => {
  it.each([
    ["a.jpg", "image/jpeg", "image"],
    ["a.JPEG", "image/jpeg", "image"],
    ["a.png", "image/png", "image"],
    ["a.webp", "image/webp", "image"],
    ["a.mp4", "video/mp4", "video"],
    ["a.mov", "video/quicktime", "video"],
  ])("accepts %s", (name, type, kind) => {
    expect(validateMediaFile(f(name, type))).toEqual({ ok: true, kind });
  });

  it.each([["a.gif", "image/gif"], ["a.webm", "video/webm"], ["a.pdf", "application/pdf"], ["noext", ""]])(
    "rejects %s",
    (name, type) => {
      expect(validateMediaFile(f(name, type)).ok).toBe(false);
    },
  );

  it("rejects a file whose type does not match its extension", () => {
    expect(validateMediaFile(f("a.png", "video/mp4")).ok).toBe(false);
  });

  it("allows images up to 20 MB and rejects larger", () => {
    expect(validateMediaFile(f("a.jpg", "image/jpeg", 20 * MB)).ok).toBe(true);
    expect(validateMediaFile(f("a.jpg", "image/jpeg", 20 * MB + 1)).ok).toBe(false);
  });

  it("allows videos up to 200 MB and rejects larger", () => {
    expect(validateMediaFile(f("a.mp4", "video/mp4", 200 * MB)).ok).toBe(true);
    expect(validateMediaFile(f("a.mp4", "video/mp4", 200 * MB + 1)).ok).toBe(false);
  });

  it("rejects empty files", () => {
    expect(validateMediaFile(f("a.jpg", "image/jpeg", 0)).ok).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMedia } from "../api";

type Reply = { status: number; body?: unknown; networkError?: boolean };
let lastUrl = "";

function installFakeXhr(reply: Reply) {
  class FakeXhr {
    status = 0;
    responseText = "";
    upload: { onprogress?: (e: unknown) => void; onload?: () => void } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    open(_m: string, url: string) {
      lastUrl = url;
    }
    setRequestHeader() {}
    abort() {
      this.onabort?.();
    }
    send() {
      queueMicrotask(() => {
        if (reply.networkError) return this.onerror?.();
        this.upload.onload?.();
        this.status = reply.status;
        this.responseText = reply.body === undefined ? "" : JSON.stringify(reply.body);
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
}

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analyzeMedia", () => {
  it("returns Demo Mode without sending anything when no backend is set", async () => {
    vi.stubEnv("VITE_TRUTHGUARD_API_URL", "");
    installFakeXhr({ status: 200 });
    lastUrl = "";
    expect(await analyzeMedia(file, "video")).toEqual({ mode: "demo", reason: "not_configured" });
    expect(lastUrl).toBe("");
  });

  it("posts videos to /analyze/video and images to /analyze/image", async () => {
    vi.stubEnv("VITE_TRUTHGUARD_API_URL", "https://api.example.com/");
    installFakeXhr({ status: 200, body: { truth_score: 40 } });
    await analyzeMedia(file, "video");
    expect(lastUrl).toBe("https://api.example.com/analyze/video");
    await analyzeMedia(file, "image");
    expect(lastUrl).toBe("https://api.example.com/analyze/image");
  });

  it("switches to Demo Mode when the backend is unreachable or down", async () => {
    vi.stubEnv("VITE_TRUTHGUARD_API_URL", "https://api.example.com");
    installFakeXhr({ status: 0, networkError: true });
    expect((await analyzeMedia(file, "video")).mode).toBe("demo");
    installFakeXhr({ status: 503 });
    expect((await analyzeMedia(file, "video")).mode).toBe("demo");
  });

  it("refuses to show a result when the response has no valid TruthScore", async () => {
    vi.stubEnv("VITE_TRUTHGUARD_API_URL", "https://api.example.com");
    installFakeXhr({ status: 200, body: { status: "authentic" } });
    await expect(analyzeMedia(file, "video")).rejects.toThrow();
  });
});

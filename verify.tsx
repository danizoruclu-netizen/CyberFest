import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, FileText, ImageUp, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { MediaDropzone } from "@/components/common/MediaDropzone";
import { StepList } from "@/components/common/StepList";
import { MediaAnalysisReport } from "@/components/common/MediaAnalysisReport";
import { ReportSection } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validateMediaFile, type MediaKind } from "@/lib/deepfake/media-rules";
import type { MediaAnalysisResult } from "@/lib/deepfake/analysis-result";
import { analyzeMediaWithFallback } from "@/lib/local/local-runner";
import { analyzeTextWithFallback } from "@/lib/local/text-runner";
import type { TextAnalysisResult } from "@/lib/local/text-forensics";
import { persist } from "@/lib/history/persist";
import { recordFromMedia } from "@/lib/history/scan-record";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Full Verification — TRUTHGUARD AI" },
      { name: "description", content: "Combine media and text checks into one verification report with TRUTHGUARD AI." },
      { property: "og:title", content: "Full Verification — TRUTHGUARD AI" },
      { property: "og:description", content: "Combine media and text checks into one verification report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string }
  | {
      status: "done";
      result: MediaAnalysisResult;
      text: TextAnalysisResult | null;
      source: "live" | "local";
    };

function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [run, setRun] = useState<Run>({ status: "idle" });
  const reportRef = useRef<HTMLDivElement>(null);
  const running = run.status === "running";

  const select = (picked: File) => {
    const check = validateMediaFile(picked);
    if (!check.ok) return setFileError(check.error);
    setFileError(null);
    setFile(picked);
    setKind(check.kind);
    setRun({ status: "idle" });
  };

  const submit = async () => {
    if (!file || !kind || running) return;
    setRun({ status: "running" });
    try {
      const media = await analyzeMediaWithFallback(file, kind, {});
      const text = context.trim() ? await analyzeTextWithFallback(context) : null;
      const combined: MediaAnalysisResult = text
        ? {
            ...media.result,
            truthScore: Math.round((media.result.truthScore + text.credibilityScore) / 2),
            indicators: [
              ...media.result.indicators,
              ...text.signals.map((s) => ({ label: `Text: ${s.label}`, description: s.description, severity: s.severity })),
            ],
            explanation: `${media.result.explanation}\n\n--- TEXT CONTEXT ---\n${text.summary}`,
          }
        : media.result;
      setRun({ status: "done", result: combined, text, source: media.source });
      persist(() => recordFromMedia(kind, file.name, combined, media.source));
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setRun({ status: "error", message: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Module 03"
        icon={ShieldCheck}
        title="Full Verification"
        description="Check a post as a whole — its image or video together with the caption or story it comes with."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ImageUp className="h-4 w-4 text-cyan" /> Media
          </div>
          <MediaDropzone
            file={file}
            kind={kind}
            error={fileError}
            disabled={running}
            onSelect={select}
            onClear={() => { setFile(null); setKind(null); setFileError(null); setRun({ status: "idle" }); }}
          />
        </GlassCard>
        <GlassCard className="flex flex-col">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-cyan" /> Context
          </div>
          <Label htmlFor="verify-context" className="sr-only">Caption or story</Label>
          <Textarea
            id="verify-context"
            rows={10}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste the caption, headline or story shared with the media…"
            className="min-h-56 flex-1 rounded-xl bg-glass"
            disabled={running}
          />
          <p className="mt-2 text-xs text-muted-foreground">Optional — add the caption to cross-check the media against its story.</p>
        </GlassCard>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <GlassCard className="space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Verification pipeline</h2>
          <StepList
            steps={[
              { title: "Media authenticity", description: "Run local forensic checks on the attached media." },
              { title: "Content credibility", description: "Review the accompanying text and its wording." },
              { title: "Cross-check", description: "See whether the media and the story actually match." },
              { title: "Unified report", description: "One clear summary you can save or share." },
            ]}
          />
          <Button variant="hero" size="lg" className="w-full" disabled={!file || running} onClick={submit}>
            {running ? <><Activity className="h-4 w-4 animate-pulse" /> Verifying…</> : <><ShieldCheck className="h-4 w-4" /> Run verification</>}
          </Button>
        </GlassCard>
        <div ref={reportRef} className="scroll-mt-24">
          {run.status === "idle" && (
            <GlassCard className="h-full p-0">
              <div className="border-b border-glass-border px-6 py-4"><h2 className="text-sm font-semibold text-foreground">Analysis report</h2></div>
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 text-cyan" />
                <p className="text-sm font-medium text-foreground">No analysis yet</p>
                <p className="text-xs">Attach media and press Run verification. Your combined report will appear here.</p>
              </div>
            </GlassCard>
          )}
          {run.status === "running" && (
            <GlassCard className="h-full p-0">
              <div className="border-b border-glass-border px-6 py-4"><h2 className="text-sm font-semibold text-foreground">Analysis report</h2></div>
              <div className="space-y-3 p-6">
                <p className="text-sm text-muted-foreground">Reading file and measuring signals…</p>
                <div className="h-1.5 animate-indeterminate rounded-full bg-gradient-primary" />
              </div>
            </GlassCard>
          )}
          {run.status === "error" && (
            <GlassCard className="h-full p-0">
              <div className="border-b border-glass-border px-6 py-4"><h2 className="text-sm font-semibold text-foreground">Analysis report</h2></div>
              <div className="p-6"><ReportSection icon={Activity} title="Verification failed"><p className="text-sm text-muted-foreground">{run.message}</p></ReportSection></div>
            </GlassCard>
          )}
          {run.status === "done" && (
            <div className="space-y-4">
              <MediaAnalysisReport
                state="result"
                fileName={file?.name ?? "media"}
                result={run.result}
              />
              {run.text && (
                <GlassCard className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="h-4 w-4 text-cyan" /> Caption / context check</h3>
                    <StatusBadge tone={run.text.verdict === "high_risk" ? "danger" : run.text.verdict === "mixed" ? "pending" : "success"}>
                      {run.text.credibilityScore}/100
                    </StatusBadge>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{run.text.summary}</p>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

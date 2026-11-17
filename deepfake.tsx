import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Info, ScanFace, ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { StepList } from "@/components/common/StepList";
import { MediaDropzone } from "@/components/common/MediaDropzone";
import { AnalysisProgress } from "@/components/common/AnalysisProgress";
import { MediaAnalysisReport } from "@/components/common/MediaAnalysisReport";
import { Button } from "@/components/ui/button";
import { validateMediaFile, type MediaKind } from "@/lib/deepfake/media-rules";
import { AnalysisCancelled, AnalysisError, type AnalysisPhase } from "@/lib/deepfake/api";
import { analyzeMediaWithFallback, type AnalysisSource } from "@/lib/local/local-runner";
import type { MediaAnalysisResult } from "@/lib/deepfake/analysis-result";
import { recordFromMedia } from "@/lib/history/scan-record";
import { persist } from "@/lib/history/persist";

export const Route = createFileRoute("/deepfake")({
  head: () => ({
    meta: [
      { title: "Deepfake Detection — TRUTHGUARD AI" },
      { name: "description", content: "Upload an image or video and check it for deepfakes, face swaps and editing traces with TRUTHGUARD AI." },
      { property: "og:title", content: "Deepfake Detection — TRUTHGUARD AI" },
      { property: "og:description", content: "Upload an image or video and get a TruthScore, suspicious indicators and a clear explanation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeepfakePage,
});

type Run =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase; uploadPercent: number }
  | { status: "error"; fileName: string; message: string }
  | { status: "done"; fileName: string; result: MediaAnalysisResult; source: AnalysisSource; notice?: string | undefined };

function DeepfakePage() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const running = run.status === "running";

  const handleSelect = useCallback((picked: File) => {
    const check = validateMediaFile(picked);
    if (!check.ok) {
      setFileError(check.error);
      return;
    }
    setFileError(null);
    setFile(picked);
    setKind(check.kind);
    setRun({ status: "idle" });
  }, []);

  const handleClear = () => {
    setFile(null);
    setKind(null);
    setFileError(null);
    setRun({ status: "idle" });
  };

  const scrollToReport = () =>
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const handleAnalyze = async () => {
    if (!file || !kind || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ status: "running", phase: "uploading", uploadPercent: 0 });
    try {
      const outcome = await analyzeMediaWithFallback(file, kind, {
        signal: controller.signal,
        onProgress: (phase, uploadPercent) => setRun({ status: "running", phase, uploadPercent }),
      });
      setRun({
        status: "done",
        fileName: file.name,
        result: outcome.result,
        source: outcome.source,
        ...(outcome.notice ? { notice: outcome.notice } : {}),
      });
      persist(() => recordFromMedia(kind, file.name, outcome.result, outcome.source));
      scrollToReport();
    } catch (err) {
      if (err instanceof AnalysisCancelled) {
        setRun({ status: "idle" });
        return;
      }
      const message = err instanceof AnalysisError ? err.message : "Something went wrong while analysing this file. Please try again.";
      setRun({ status: "error", fileName: file.name, message });
      scrollToReport();
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Module 01"
        icon={ScanFace}
        title="Deepfake Detection"
        description="Upload an image or video to check for face swaps, AI generation and editing traces."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="space-y-5 p-4 sm:p-6">
          <MediaDropzone
            file={file}
            kind={kind}
            error={fileError}
            disabled={running}
            onSelect={handleSelect}
            onClear={handleClear}
          />
          {file && fileError && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fileError} Your current file is still selected.
            </p>
          )}

          {run.status === "running" ? (
            <AnalysisProgress phase={run.phase} uploadPercent={run.uploadPercent} onCancel={() => abortRef.current?.abort()} />
          ) : (
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={!file}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <ScanSearch className="h-5 w-5" /> Analyze Media
            </Button>
          )}
          {!file && <p className="text-center text-xs text-muted-foreground">Choose a file to enable analysis.</p>}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard>
            <h2 className="mb-5 text-sm font-semibold text-foreground">What we will check</h2>
            <StepList
              steps={[
                { title: "Facial consistency", description: "Blending edges, lighting and skin texture across the face." },
                { title: "Generation artifacts", description: "Patterns typical of AI image and video generators." },
                { title: "Metadata & compression", description: "Signs of re-encoding, editing software or missing data." },
              ]}
            />
          </GlassCard>
          <GlassCard className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Confidence shows how much evidence was measured; uncertainty shows how much the score could change with more data. Both are listed in every report.
            </p>
          </GlassCard>
        </div>
      </div>

      <div className="mt-6">
        <MediaAnalysisReport
          ref={reportRef}
          {...(run.status === "done"
            ? { state: "result" as const, fileName: run.fileName, result: run.result, source: run.source }
            : run.status === "error"
              ? { state: "error" as const, fileName: run.fileName, message: run.message }
              : { state: "empty" as const })}
        />
      </div>
    </>
  );
}

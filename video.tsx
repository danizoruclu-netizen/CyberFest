import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Activity, Clock, Film, FileText, Gauge, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { StepList } from "@/components/common/StepList";
import { MediaDropzone } from "@/components/common/MediaDropzone";
import { AnalysisProgress } from "@/components/common/AnalysisProgress";
import { ReportSection } from "@/components/common/DemoNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { FrameTimeline } from "@/components/common/FrameTimeline";
import { Button } from "@/components/ui/button";
import { recordFromVideo } from "@/lib/history/scan-record";
import { persist } from "@/lib/history/persist";
import { AnalysisCancelled, AnalysisError, type AnalysisPhase } from "@/lib/deepfake/api";
import { analyzeVideoWithFallback, type AnalysisSource } from "@/lib/local/local-runner";
import { formatTimestamp, validateVideoFile, VIDEO_ACCEPT, VIDEO_FORMATS, type VideoAnalysisResult } from "@/lib/video/video-analysis";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Video Analysis — TRUTHGUARD AI" },
      { name: "description", content: "Check MP4, MOV and AVI videos frame by frame for deepfake manipulation with TRUTHGUARD AI." },
      { property: "og:title", content: "Video Analysis — TRUTHGUARD AI" },
      { property: "og:description", content: "Frame-by-frame deepfake checks with suspicious timestamps and a clear explanation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoPage,
});

type Run =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase; pct: number }
  | { status: "error"; message: string }
  | { status: "done"; result: VideoAnalysisResult; source: AnalysisSource; notice?: string | undefined };

function VideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const running = run.status === "running";

  const select = (f: File) => {
    const v = validateVideoFile(f);
    if (!v.ok) return setFileError(v.error);
    setFileError(null);
    setFile(f);
    setRun({ status: "idle" });
  };

  const analyze = async () => {
    if (!file || running) return;
    const c = new AbortController();
    abortRef.current = c;
    setRun({ status: "running", phase: "uploading", pct: 0 });
    try {
      const out = await analyzeVideoWithFallback(file, { signal: c.signal, onProgress: (phase, pct) => setRun({ status: "running", phase, pct }) });
      setRun({
        status: "done",
        result: out.result,
        source: out.source,
        ...(out.notice ? { notice: out.notice } : {}),
      });
      persist(() => recordFromVideo(file.name, out.result, out.source));
    } catch (e) {
      if (e instanceof AnalysisCancelled) return setRun({ status: "idle" });
      setRun({ status: "error", message: e instanceof AnalysisError ? e.message : "Something went wrong. Please try again." });
    }
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <PageHeader eyebrow="Module 01b" icon={Film} title="Video Analysis" description="Upload a video to check it frame by frame for face swaps, lip-sync edits and AI generation." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="space-y-5 p-4 sm:p-6">
          <MediaDropzone
            file={file}
            kind={file ? "video" : null}
            error={fileError}
            disabled={running}
            onSelect={select}
            onClear={() => { setFile(null); setFileError(null); setRun({ status: "idle" }); }}
            accept={VIDEO_ACCEPT}
            formats={VIDEO_FORMATS}
            limitsLabel="Videos up to 500 MB"
          />
          {file && fileError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{fileError} Your current video is still selected.</p>}
          {run.status === "running" ? (
            <AnalysisProgress phase={run.phase} uploadPercent={run.pct} onCancel={() => abortRef.current?.abort()} />
          ) : (
            <Button variant="hero" size="lg" className="w-full" disabled={!file} onClick={analyze}>
              <Activity className="h-4 w-4" /> Analyze Video
            </Button>
          )}
          {!file && <p className="text-center text-xs text-muted-foreground">Choose a video to enable analysis. AVI files may not preview in every browser.</p>}
        </GlassCard>
        <GlassCard>
          <h2 className="mb-5 text-sm font-semibold text-foreground">What we will check</h2>
          <StepList steps={[
            { title: "Frame sampling", description: "Key frames are extracted across the whole video." },
            { title: "Face & motion consistency", description: "Blending, flicker and unnatural movement between frames." },
            { title: "Audio-visual sync", description: "Lip movement compared against the soundtrack." },
          ]} />
        </GlassCard>
      </div>
      <div className="mt-6">
        <GlassCard ref={reportRef} className="scroll-mt-24 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Video analysis report</h2>
              {file && run.status !== "idle" && <p className="truncate text-xs text-muted-foreground">{file.name}</p>}
            </div>
            {run.status === "done" ? <StatusBadge tone="success">Analysis complete</StatusBadge> : run.status === "error" ? <StatusBadge tone="danger">Failed</StatusBadge> : <StatusBadge tone="muted">Awaiting input</StatusBadge>}
          </div>
          {(run.status === "idle" || run.status === "running") && <EmptyState icon={Activity} title="No analysis yet" description="Upload a video and press Analyze Video. Your report will appear here." />}
          {run.status === "error" && <div className="p-5 sm:p-6"><EmptyState icon={AlertTriangle} title="Analysis didn't complete" description={run.message} className="py-8" /></div>}
          {run.status === "done" && <VideoResult r={run.result} />}
        </GlassCard>
      </div>
    </>
  );
}

function VideoResult({ r }: { r: VideoAnalysisResult }) {
  const bad = r.verdict === "manipulated";
  const Icon = bad ? ShieldAlert : ShieldCheck;
  return (
    <div className="animate-fade-up space-y-5 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <ReportSection icon={Icon} title="Status">
          <p className={`flex items-center gap-2 text-lg font-semibold ${bad ? "text-destructive" : "text-success"}`}><Icon className="h-5 w-5" />{bad ? "Potentially Manipulated" : "Authentic"}</p>
        </ReportSection>
        <ReportSection icon={Gauge} title="Confidence">
          <p className="font-display text-3xl font-bold text-foreground">{r.confidence === null ? "—" : `${r.confidence}%`}</p>
        </ReportSection>
        <ReportSection icon={AlertTriangle} title="Suspicious frames">
          <p className="font-display text-3xl font-bold text-foreground">{r.suspiciousFrames.length}</p>
          {r.framesAnalyzed !== null && <p className="text-xs text-muted-foreground">of {r.framesAnalyzed} frames analysed</p>}
        </ReportSection>
      </div>
      <ReportSection icon={Clock} title="Frame-by-frame timeline">
        <FrameTimeline duration={r.durationSec} timeline={r.timeline} frames={r.suspiciousFrames} />
      </ReportSection>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportSection icon={AlertTriangle} title="Suspicious timestamps">
          {r.suspiciousFrames.length === 0 ? <p className="text-sm text-muted-foreground">No suspicious frames reported.</p> : (
            <ul className="space-y-2">
              {r.suspiciousFrames.map((f, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-glass-border bg-background/40 p-3 text-sm">
                  <span className="font-mono text-cyan">{formatTimestamp(f.timestamp)}</span>
                  <span className="flex-1 text-muted-foreground">{f.reason || "Irregularity detected"}</span>
                  <StatusBadge tone={f.score >= 60 ? "danger" : f.score >= 30 ? "pending" : "info"}>{f.score}%</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </ReportSection>
        <ReportSection icon={FileText} title="Detailed explanation">
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.explanation || "The service didn't include an explanation."}</p>
        </ReportSection>
      </div>
    </div>
  );
}

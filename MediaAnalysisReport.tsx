import type { Ref } from "react";
import { AlertTriangle, Activity, FileText, Gauge, Info, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import { TruthScoreRing } from "./TruthScoreRing";
import { cn } from "@/lib/utils";
import type { AuthenticityLevel, IndicatorSeverity, MediaAnalysisResult } from "@/lib/deepfake/analysis-result";

type Props =
  | { state: "empty" }
  | { state: "error"; fileName: string; message: string }
  | { state: "result"; fileName: string; result: MediaAnalysisResult };

const LEVEL = {
  authentic: { icon: ShieldCheck, tone: "success", text: "text-success" },
  uncertain: { icon: ShieldQuestion, tone: "pending", text: "text-primary-glow" },
  manipulated: { icon: ShieldAlert, tone: "danger", text: "text-destructive" },
  unknown: { icon: ShieldQuestion, tone: "muted", text: "text-muted-foreground" },
} as const satisfies Record<AuthenticityLevel, unknown>;

const SEVERITY_TONE: Record<IndicatorSeverity, "info" | "pending" | "danger"> = {
  low: "info",
  medium: "pending",
  high: "danger",
};

function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value === null ? "Not reported" : `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background/70">
        <div className="h-full rounded-full bg-gradient-primary transition-all duration-700" style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children, className }: { icon: typeof Info; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-glass-border bg-glass/50 p-5", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-cyan" /> {title}
      </h3>
      {children}
    </div>
  );
}

export function MediaAnalysisReport({ ref, ...props }: Props & { ref?: Ref<HTMLDivElement> }) {
  const badge =
    props.state === "result" ? (
      <StatusBadge tone="success">Analysis complete</StatusBadge>
    ) : props.state === "error" ? (
      <StatusBadge tone="danger">Failed</StatusBadge>
    ) : (
      <StatusBadge tone="muted">Awaiting input</StatusBadge>
    );

  return (
    <GlassCard ref={ref} className="scroll-mt-24 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Analysis report</h2>
          {props.state !== "empty" && (
            <p className="truncate text-xs text-muted-foreground" title={props.fileName}>
              {props.fileName}
            </p>
          )}
        </div>
        {badge}
      </div>

      {props.state === "empty" && (
        <EmptyState
          icon={Activity}
          title="No analysis yet"
          description="Upload an image or video and press Analyze Media. Your report will appear here."
        />
      )}

      {props.state === "error" && (
        <div className="p-5 sm:p-6">
          <EmptyState icon={AlertTriangle} title="Analysis didn't complete" description={props.message} className="py-8" />
        </div>
      )}

      {props.state === "result" && <ResultBody result={props.result} />}
    </GlassCard>
  );
}

function ResultBody({ result }: { result: MediaAnalysisResult }) {
  const level = LEVEL[result.authenticity.level];
  const LevelIcon = level.icon;
  return (
    <div className="animate-fade-up space-y-5 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <Section icon={Gauge} title="TruthScore" className="flex flex-col items-center">
          <TruthScoreRing score={result.truthScore} />
          <p className="mt-2 text-xs text-muted-foreground">0 = likely manipulated · 100 = likely authentic</p>
        </Section>
        <div className="grid gap-5 sm:grid-cols-2">
          <Section icon={LevelIcon} title="Authenticity status">
            <div className={cn("flex items-center gap-2 text-lg font-semibold", level.text)}>
              <LevelIcon className="h-5 w-5" /> {result.authenticity.label}
            </div>
            {result.modelVersion && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">Model: {result.modelVersion}</p>
            )}
          </Section>
          <Section icon={Gauge} title="Confidence & uncertainty">
            <div className="space-y-4">
              <Meter label="Confidence" value={result.confidence} hint="How sure the engine is about this verdict." />
              <Meter
                label="Uncertainty"
                value={result.uncertainty}
                hint={result.uncertaintyNote ?? "How much the result could change with more evidence."}
              />
            </div>
          </Section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={AlertTriangle} title={`Suspicious indicators (${result.indicators.length})`}>
          {result.indicators.length === 0 ? (
            <p className="text-sm text-muted-foreground">The engine didn't report any suspicious indicators.</p>
          ) : (
            <ul className="space-y-3">
              {result.indicators.map((ind, i) => (
                <li key={`${ind.label}-${i}`} className="rounded-lg border border-glass-border bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{ind.label}</span>
                    {ind.severity && <StatusBadge tone={SEVERITY_TONE[ind.severity]}>{ind.severity}</StatusBadge>}
                  </div>
                  {ind.description && <p className="mt-1 text-sm text-muted-foreground">{ind.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={FileText} title="Detailed explanation">
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {result.explanation ?? "The engine didn't include an explanation with this result."}
          </p>
        </Section>
      </div>
    </div>
  );
}

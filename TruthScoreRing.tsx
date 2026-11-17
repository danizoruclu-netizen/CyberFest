import { cn } from "@/lib/utils";
import { scoreBand } from "@/lib/deepfake/analysis-result";

const BAND_CLASS = { high: "text-success", medium: "text-primary-glow", low: "text-destructive" } as const;

/** Circular 0–100 TruthScore. Pass null to show an empty "—" ring (no result). */
export function TruthScoreRing({ score, className }: { score: number | null; className?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = score === null ? c : c - (score / 100) * c;
  const tone = score === null ? "text-muted-foreground" : BAND_CLASS[scoreBand(score)];

  return (
    <div className={cn("relative h-36 w-36", className)} role="img" aria-label={score === null ? "TruthScore not available" : `TruthScore ${score} out of 100`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-glass-border" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-1000 ease-out", tone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display text-4xl font-bold", tone)}>{score ?? "—"}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalysisPhase } from "@/lib/deepfake/api";

type Props = { phase: AnalysisPhase; uploadPercent: number; onCancel: () => void };

/**
 * Upload progress follows real bytes sent. For local checks the phases report
 * actual stages (reading, sampling) instead of pretending an upload happened.
 */
export function AnalysisProgress({ phase, uploadPercent, onCancel }: Props) {
  const steps = [
    { key: "upload", label: phase === "preparing" ? "Reading file locally" : "Uploading file" },
    { key: "analysis", label: phase === "sampling" ? "Measuring local signals" : "Running detection" },
    { key: "report", label: "Preparing report" },
  ] as const;
  const activeIndex = phase === "uploading" || phase === "preparing" ? 0 : 1;

  return (
    <div className="animate-fade-up rounded-2xl border border-cyan/25 bg-primary/10 p-5" role="status" aria-live="polite">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          {phase === "uploading"
            ? `Uploading… ${uploadPercent}%`
            : phase === "preparing"
              ? "Reading file locally…"
              : phase === "sampling"
                ? `Measuring signals… ${uploadPercent}%`
                : "Analysing media…"}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-background/70">
        {phase === "uploading" || phase === "preparing" || phase === "sampling" ? (
          <div className="h-full rounded-full bg-gradient-primary transition-all duration-300" style={{ width: `${uploadPercent}%` }} />
        ) : (
          <div className="absolute inset-y-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-gradient-primary" />
        )}
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-2 text-xs",
                done ? "text-success" : active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]",
                  done ? "border-success/40 bg-success/15" : active ? "border-cyan/50 bg-primary/20 text-cyan" : "border-glass-border",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

type Props = {
  icon: LucideIcon;
  title: string;
  hint: string;
  formats: string[];
};

/** Visual placeholder for a future upload area. Intentionally not interactive yet. */
export function UploadZone({ icon: Icon, title, hint, formats }: Props) {
  return (
    <div
      aria-disabled="true"
      className="relative overflow-hidden rounded-2xl border-2 border-dashed border-glass-border bg-glass/40 px-6 py-12 text-center"
    >
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-cyan/10 to-transparent" />
      <div className="relative flex flex-col items-center">
        <div className="mb-4 flex h-14 w-14 animate-float items-center justify-center rounded-2xl border border-cyan/25 bg-primary/15 text-cyan">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {formats.map((f) => (
            <StatusBadge key={f} tone="muted">
              {f}
            </StatusBadge>
          ))}
        </div>
        <StatusBadge tone="pending" className="mt-5">
          <Lock className="h-3 w-3" /> Engine not connected
        </StatusBadge>
      </div>
    </div>
  );
}

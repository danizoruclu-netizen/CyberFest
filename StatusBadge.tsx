import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
  {
    variants: {
      tone: {
        info: "border-cyan/30 bg-cyan/10 text-cyan",
        primary: "border-primary/40 bg-primary/15 text-primary-glow",
        pending: "border-primary/30 bg-primary/10 text-primary-glow",
        success: "border-success/30 bg-success/10 text-success",
        danger: "border-destructive/40 bg-destructive/10 text-destructive",
        muted: "border-glass-border bg-glass text-muted-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export function StatusBadge({
  tone,
  className,
  children,
}: VariantProps<typeof badge> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Shield + verification check mark. Colors come from design tokens. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn("h-9 w-9", className)}>
      <defs>
        <linearGradient id={`tg-stroke-${id}`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--cyan)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
        <linearGradient id={`tg-fill-${id}`} x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M24 4 L40 10 V22.5 C40 32.5 33.2 40.6 24 44 C14.8 40.6 8 32.5 8 22.5 V10 Z"
        fill={`url(#tg-fill-${id})`}
        stroke={`url(#tg-stroke-${id})`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M24 9.5 L35 13.6 V22.5 C35 29.8 30.4 35.9 24 38.6"
        stroke="var(--cyan)"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 24.5 L21.8 29.5 L32 18.5"
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-[0.08em] text-foreground">
            TRUTHGUARD
            <span className="ml-1 text-cyan">AI</span>
          </div>
          <div className="mt-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground max-[380px]:hidden">
            Verify before you share
          </div>
        </div>
      )}
    </div>
  );
}

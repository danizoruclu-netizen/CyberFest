export function SystemStatusCard() {
  return (
    <div className="glass-card mt-6 overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <span className="eyebrow text-success">Analysis ready</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Media, URL and text checks are running. Every result is built from measured signals.
      </p>
    </div>
  );
}

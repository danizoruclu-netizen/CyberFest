/** Shared section shell used across analysis reports. */
export function ReportSection({ icon: Icon, title, children, className = "" }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-glass-border bg-glass/50 p-5 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-cyan" /> {title}
      </h3>
      {children}
    </div>
  );
}

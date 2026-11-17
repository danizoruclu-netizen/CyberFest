import { Activity } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { EmptyState } from "./EmptyState";

export function ResultsPlaceholder({ label }: { label: string }) {
  return (
    <GlassCard className="p-0">
      <div className="flex items-center justify-between border-b border-glass-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">Analysis report</h2>
        <span className="eyebrow text-muted-foreground">Awaiting input</span>
      </div>
      <EmptyState
        icon={Activity}
        title="No analysis yet"
        description={`Once the engine is connected, your ${label} report will appear here.`}
      />
    </GlassCard>
  );
}

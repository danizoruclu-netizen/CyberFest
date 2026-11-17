import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileSearch, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { StatusBadge } from "./StatusBadge";
import { VerdictBadge } from "./VerdictBadge";
import { useScans } from "@/lib/history/scan-store";
import { filterScans, formatDateTime, scanStats, TYPE_LABEL } from "@/lib/history/scan-record";

/** Live counts from stored scan records. */
export function DashboardStats() {
  const scans = useScans();
  const st = scanStats(scans ?? []);
  const items = [
    { label: "Completed scans", value: st.total, icon: FileSearch, tone: "text-cyan" },
    { label: "Authentic content", value: st.authentic, icon: ShieldCheck, tone: "text-success" },
    { label: "Potentially fake", value: st.fake, icon: ShieldAlert, tone: "text-destructive" },
    { label: "Suspicious", value: st.suspicious, icon: ShieldQuestion, tone: "text-primary-glow" },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((s, i) => (
        <GlassCard key={s.label} className="flex animate-fade-up items-center gap-4 p-5" style={{ animationDelay: `${200 + i * 80}ms` }}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-glass-border bg-primary/15 ${s.tone}`}><s.icon className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-2xl font-bold text-foreground">{scans === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        </GlassCard>
      ))}
    </section>
  );
}

/** Shows the latest real scans; falls back to the clearly labelled demo preview when there are none. */
export function RecentActivity({ demoTable }: { demoTable: ReactNode }) {
  const scans = useScans();
  const recent = scans ? filterScans(scans, { q: "", type: "all", verdict: "all", sort: "newest" }).slice(0, 5) : [];
  const live = recent.length > 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
          {live ? <StatusBadge tone="success">Verified results</StatusBadge> : <StatusBadge tone="muted">Demo data</StatusBadge>}
        </div>
        <Link to="/history" className="text-xs font-medium text-cyan hover:underline">View history</Link>
      </div>
      {live ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-glass-border">{["File or URL", "Type", "Date", "Result", "Confidence"].map((h, i) => <th key={h} className={`eyebrow px-6 py-3 font-normal text-muted-foreground ${i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-b border-glass-border/60 last:border-0 hover:bg-glass/40">
                  <td className="max-w-[260px] px-6 py-3.5"><Link to="/report/$scanId" params={{ scanId: s.id }} className="block truncate font-medium text-foreground hover:text-cyan">{s.target}</Link></td>
                  <td className="px-6 py-3.5 text-muted-foreground">{TYPE_LABEL[s.type]}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                  <td className="px-6 py-3.5"><VerdictBadge verdict={s.verdict} /></td>
                  <td className="px-6 py-3.5 text-right font-mono text-foreground">{s.confidence === null ? "—" : `${s.confidence}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {demoTable}
          <p className="border-t border-glass-border px-6 py-3 text-xs text-muted-foreground">Sample records shown for interface preview only — they are not real analysis results. Your real scans will replace them here.</p>
        </>
      )}
    </>
  );
}

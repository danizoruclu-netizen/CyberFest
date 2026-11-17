import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe, History, Image as ImageIcon, Loader2, Search, SearchX, Video } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { EmptyState } from "@/components/common/EmptyState";
import { VerdictBadge } from "@/components/common/VerdictBadge";
import { DeleteScanButton } from "@/components/common/DeleteScanButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScans } from "@/lib/history/scan-store";
import { filterScans, formatDateTime, TYPE_LABEL, type HistoryQuery, type ScanType } from "@/lib/history/scan-record";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Scan History — TRUTHGUARD AI" },
      { name: "description", content: "Search, filter and review every image, video and URL analysis you've run with TRUTHGUARD AI." },
      { property: "og:title", content: "Scan History — TRUTHGUARD AI" },
      { property: "og:description", content: "Search, filter and review your past verification reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

export const TYPE_ICON: Record<ScanType, typeof ImageIcon> = { image: ImageIcon, video: Video, url: Globe };

function HistoryPage() {
  const scans = useScans();
  const [query, setQuery] = useState<HistoryQuery>({ q: "", type: "all", verdict: "all", sort: "newest" });
  const rows = useMemo(() => (scans ? filterScans(scans, query) : []), [scans, query]);
  const filtered = query.q !== "" || query.type !== "all" || query.verdict !== "all";

  return (
    <>
      <PageHeader eyebrow="Records" icon={History} title="Scan History" description="Every completed analysis is saved here — both backend results and measured local forensic checks. Nothing is invented." />

      <GlassCard className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_190px_150px]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value })} placeholder="Search file name, URL or scan ID…" className="h-10 rounded-xl bg-glass pl-9" aria-label="Search scans" />
        </div>
        <Select value={query.type} onValueChange={(v) => setQuery({ ...query, type: v as HistoryQuery["type"] })}>
          <SelectTrigger className="h-10 rounded-xl bg-glass" aria-label="Filter by type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="image">Images</SelectItem><SelectItem value="video">Videos</SelectItem><SelectItem value="url">URLs</SelectItem></SelectContent>
        </Select>
        <Select value={query.verdict} onValueChange={(v) => setQuery({ ...query, verdict: v as HistoryQuery["verdict"] })}>
          <SelectTrigger className="h-10 rounded-xl bg-glass" aria-label="Filter by result"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All results</SelectItem><SelectItem value="authentic">Authentic</SelectItem><SelectItem value="fake">Potentially Fake</SelectItem><SelectItem value="suspicious">Suspicious</SelectItem></SelectContent>
        </Select>
        <Select value={query.sort} onValueChange={(v) => setQuery({ ...query, sort: v as HistoryQuery["sort"] })}>
          <SelectTrigger className="h-10 rounded-xl bg-glass" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
        </Select>
      </GlassCard>

      <GlassCard className="overflow-hidden p-0">
        {scans === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
        ) : scans.length === 0 ? (
          <EmptyState icon={History} title="No scans yet" description="Run an image, video or URL analysis and each completed result will be listed here."
            action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="hero"><Link to="/deepfake">Check media</Link></Button><Button asChild variant="glass"><Link to="/url">Check a URL</Link></Button></div>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No matching scans" description="Try a different search or clear the filters."
            action={filtered ? <Button variant="glass" onClick={() => setQuery({ q: "", type: "all", verdict: "all", sort: query.sort })}>Clear filters</Button> : undefined} />
        ) : (
          <>
            <div className="hidden grid-cols-[1.6fr_100px_170px_170px_100px_120px] gap-4 border-b border-glass-border px-6 py-3 lg:grid">
              {["File or URL", "Type", "Date & time", "Result", "Confidence", ""].map((c) => <span key={c} className="eyebrow text-muted-foreground">{c}</span>)}
            </div>
            <ul className="divide-y divide-glass-border">
              {rows.map((s) => {
                const Icon = TYPE_ICON[s.type];
                return (
                  <li key={s.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-glass/40 lg:grid-cols-[1.6fr_100px_170px_170px_100px_120px] lg:items-center lg:gap-4 lg:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-primary/15 text-cyan"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground" title={s.target}>{s.target}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{s.id}</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground"><span className="lg:hidden">Type: </span>{TYPE_LABEL[s.type]}</span>
                    <span className="text-sm text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                    <span><VerdictBadge verdict={s.verdict} /></span>
                    <span className="font-mono text-sm text-foreground"><span className="font-sans text-muted-foreground lg:hidden">Confidence: </span>{s.confidence === null ? "—" : `${s.confidence}%`}</span>
                    <div className="flex items-center gap-1 lg:justify-end">
                      <Button asChild variant="glass" size="sm"><Link to="/report/$scanId" params={{ scanId: s.id }}>View <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
                      <DeleteScanButton id={s.id} target={s.target} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-glass-border px-6 py-3 text-xs text-muted-foreground">Showing {rows.length} of {scans.length} scans · saved in this browser</p>
          </>
        )}
      </GlassCard>
    </>
  );
}

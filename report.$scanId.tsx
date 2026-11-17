import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Download, FileSearch, FileText, Gauge, Lightbulb, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { VerdictBadge } from "@/components/common/VerdictBadge";
import { DeleteScanButton } from "@/components/common/DeleteScanButton";
import { ReportSection } from "@/components/common/DemoNotice";
import { Button } from "@/components/ui/button";
import { useScan } from "@/lib/history/scan-store";
import { formatDateTime, TYPE_LABEL, VERDICT_LABEL } from "@/lib/history/scan-record";
import { buildReportPdf, downloadBlob } from "@/lib/history/report-pdf";

export const Route = createFileRoute("/report/$scanId")({
  head: ({ params }) => ({
    meta: [
      { title: `Report ${params.scanId} — TRUTHGUARD AI` },
      { name: "description", content: "Detailed TRUTHGUARD AI analysis report with findings, indicators and recommendations." },
      { property: "og:title", content: `Analysis report ${params.scanId} — TRUTHGUARD AI` },
      { property: "og:description", content: "Detailed analysis report with findings, indicators and recommendations." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

const SEV = { low: "info", medium: "info", high: "danger" } as const;

function ReportPage() {
  const { scanId } = Route.useParams();
  const scan = useScan(scanId);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (scan === undefined)
    return <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>;
  if (scan === null)
    return (
      <GlassCard><EmptyState icon={FileSearch} title="Report not found" description={`There's no saved scan with ID ${scanId}. It may have been deleted or saved in another browser.`}
        action={<Button asChild variant="hero"><Link to="/history">Back to history</Link></Button>} /></GlassCard>
    );

  const download = async () => {
    setBusy(true);
    try {
      const blob = await buildReportPdf(scan);
      downloadBlob(blob, `truthguard-report-${scan.id}.pdf`);
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const meta: [string, string][] = [
    ["Scan ID", scan.id],
    ["Analysis type", TYPE_LABEL[scan.type]],
    [scan.type === "url" ? "URL" : "File name", scan.target],
    ["Date & time", formatDateTime(scan.createdAt)],
    ["Source", scan.source === "local" ? "On-device analysis" : "Detection engine"],
  ];

  return (
    <>
      <Link to="/history" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cyan"><ArrowLeft className="h-4 w-4" /> Scan History</Link>
      <PageHeader eyebrow="Analysis report" icon={FileText} title={VERDICT_LABEL[scan.verdict]} description={scan.target} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone="success">Report ready</StatusBadge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="hero" onClick={download} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF Report</Button>
          <DeleteScanButton id={scan.id} target={scan.target} label onDeleted={() => navigate({ to: "/history" })} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <GlassCard className="space-y-4">
          <dl className="space-y-3">
            {meta.map(([k, v]) => (
              <div key={k}><dt className="eyebrow text-muted-foreground">{k}</dt><dd className="mt-0.5 break-all text-sm text-foreground">{v}</dd></div>
            ))}
          </dl>
          <div className="grid grid-cols-2 gap-3 border-t border-glass-border pt-4">
            <div><p className="eyebrow text-muted-foreground">Result</p><div className="mt-1.5"><VerdictBadge verdict={scan.verdict} /></div></div>
            <div><p className="eyebrow text-muted-foreground">Confidence</p><p className="mt-1 font-display text-2xl font-bold text-foreground">{scan.confidence === null ? "—" : `${scan.confidence}%`}</p></div>
            {scan.score !== null && <div><p className="eyebrow text-muted-foreground">{scan.scoreLabel}</p><p className="mt-1 font-display text-2xl font-bold text-cyan">{scan.score}{scan.scoreLabel === "Suspicious frames" ? "" : "/100"}</p></div>}
          </div>
        </GlassCard>
        <div className="space-y-6">
          <ReportSection icon={Gauge} title="Detection summary"><p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{scan.summary}</p></ReportSection>
          <ReportSection icon={ListChecks} title="Technical findings">
            <ul className="space-y-1.5">{scan.findings.map((f, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />{f}</li>)}</ul>
          </ReportSection>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ReportSection icon={AlertTriangle} title={`Suspicious indicators (${scan.indicators.length})`}>
          {scan.indicators.length === 0 ? <p className="text-sm text-muted-foreground">No suspicious indicators were reported.</p> : (
            <ul className="space-y-2">{scan.indicators.map((ind, i) => (
              <li key={i} className="rounded-lg border border-glass-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-foreground">{ind.label}</span>{ind.severity && <StatusBadge tone={SEV[ind.severity]}>{ind.severity}</StatusBadge>}</div>
                {ind.description && <p className="mt-1 text-sm text-muted-foreground">{ind.description}</p>}
              </li>))}
            </ul>
          )}
        </ReportSection>
        <ReportSection icon={Lightbulb} title="Recommendations">
          <ul className="space-y-1.5">{scan.recommendations.map((r, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />{r}</li>)}</ul>
        </ReportSection>
      </div>
    </>
  );
}

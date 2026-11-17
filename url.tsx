import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Fish, Gauge, Globe, Link2, Loader2, Server, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { StepList } from "@/components/common/StepList";
import { ReportSection } from "@/components/common/DemoNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TruthScoreRing } from "@/components/common/TruthScoreRing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { recordFromUrl } from "@/lib/history/scan-record";
import { persist } from "@/lib/history/persist";
import { AnalysisError } from "@/lib/deepfake/api";
import { analyzeUrlWithFallback, type AnalysisSource } from "@/lib/local/local-runner";
import { validateUrl, type UrlAnalysisResult, type UrlFinding } from "@/lib/url/url-analysis";

export const Route = createFileRoute("/url")({
  head: () => ({
    meta: [
      { title: "URL Analysis — TRUTHGUARD AI" },
      { name: "description", content: "Check a website link for phishing signs, suspicious redirects and domain trust with TRUTHGUARD AI." },
      { property: "og:title", content: "URL Analysis — TRUTHGUARD AI" },
      { property: "og:description", content: "Website trust score, phishing indicators, domain info and a final risk assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UrlPage,
});

type Run =
  | { status: "idle" }
  | { status: "running"; url: string }
  | { status: "error"; url: string; message: string }
  | { status: "done"; url: string; result: UrlAnalysisResult; source: AnalysisSource; notice?: string | undefined };

function UrlPage() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const reportRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateUrl(value);
    if (!v.ok) return setError(v.error);
    setError(null);
    setRun({ status: "running", url: v.url });
    try {
      const out = await analyzeUrlWithFallback(value, v.url, v.hostname);
      setRun({
        status: "done",
        url: v.url,
        result: out.result,
        source: out.source,
        ...(out.notice ? { notice: out.notice } : {}),
      });
      persist(() => recordFromUrl(v.url, out.result, out.source));
    } catch (err) {
      setRun({ status: "error", url: v.url, message: err instanceof AnalysisError ? err.message : "Something went wrong. Please try again." });
    }
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const running = run.status === "running";

  return (
    <>
      <PageHeader eyebrow="Module 04" icon={Globe} title="URL Analysis" description="Check a link before you click or share it — phishing signs, redirects and how trustworthy the site looks." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="space-y-5">
          <form onSubmit={submit} noValidate className="space-y-3">
            <Label htmlFor="url-input">Website address</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="url-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://example.com/login" className="h-11 rounded-xl bg-glass pl-9" aria-invalid={!!error} disabled={running} inputMode="url" />
              </div>
              <Button variant="hero" size="lg" type="submit" disabled={running || !value.trim()}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Analyze URL
              </Button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </form>
          {run.status !== "idle" && (
            <div className="rounded-xl border border-glass-border bg-background/40 p-4">
              <p className="eyebrow mb-1">Submitted URL</p>
              <p className="break-all font-mono text-sm text-cyan">{run.url}</p>
            </div>
          )}
          {running && (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm text-muted-foreground">Checking domain, redirects and security signals…</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-background/70"><div className="h-full w-1/3 animate-indeterminate rounded-full bg-gradient-primary" /></div>
            </div>
          )}
        </GlassCard>
        <GlassCard>
          <h2 className="mb-5 text-sm font-semibold text-foreground">What we will check</h2>
          <StepList steps={[
            { title: "Domain reputation", description: "Age, registrar and whether the domain imitates a known brand." },
            { title: "Redirect chain", description: "Where the link really takes you after every hop." },
            { title: "Security signals", description: "HTTPS, login-form tricks and known phishing patterns." },
          ]} />
        </GlassCard>
      </div>
      <div className="mt-6">
        <GlassCard ref={reportRef} className="scroll-mt-24 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">URL analysis report</h2>
            {run.status === "done" ? <StatusBadge tone="success">Analysis complete</StatusBadge> : run.status === "error" ? <StatusBadge tone="danger">Failed</StatusBadge> : <StatusBadge tone="muted">Awaiting input</StatusBadge>}
          </div>
          {(run.status === "idle" || run.status === "running") && <EmptyState icon={Globe} title="No analysis yet" description="Enter a website address and press Analyze URL. Your report will appear here." />}
          {run.status === "error" && <div className="p-5 sm:p-6"><EmptyState icon={AlertTriangle} title="Analysis didn't complete" description={run.message} className="py-8" /></div>}
          {run.status === "done" && <UrlResult r={run.result} />}
        </GlassCard>
      </div>
    </>
  );
}

const RISK = { low: ["success", "Low risk", "text-success"], medium: ["pending", "Medium risk", "text-primary-glow"], high: ["danger", "High risk", "text-destructive"] } as const;

function Findings({ items, empty }: { items: UrlFinding[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li key={i} className="rounded-lg border border-glass-border bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-foreground">{f.label}</span><StatusBadge tone={RISK[f.severity][0]}>{f.severity}</StatusBadge></div>
          {f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function UrlResult({ r }: { r: UrlAnalysisResult }) {
  const [, label, text] = RISK[r.risk];
  const d = r.domain;
  const row = (k: string, v: string | null) => (
    <div className="flex justify-between gap-3 border-b border-glass-border py-1.5 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right text-foreground">{v ?? "Not reported"}</dd></div>
  );
  return (
    <div className="animate-fade-up space-y-5 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <ReportSection icon={Gauge} title="Website trust score" className="flex flex-col items-center"><TruthScoreRing score={r.trustScore} /></ReportSection>
        <ReportSection icon={ShieldAlert} title="Final risk assessment">
          <p className={`text-lg font-semibold ${text}`}>{label}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.summary || "The service didn't include a summary."}</p>
        </ReportSection>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportSection icon={Fish} title={`Phishing indicators (${r.phishingIndicators.length})`}><Findings items={r.phishingIndicators} empty="No phishing indicators reported." /></ReportSection>
        <ReportSection icon={AlertTriangle} title={`Security warnings (${r.warnings.length})`}><Findings items={r.warnings} empty="No security warnings reported." /></ReportSection>
        <ReportSection icon={Server} title="Domain information">
          <dl>{row("Domain", d.name)}{row("Registrar", d.registrar)}{row("Domain age", d.ageDays === null ? null : `${d.ageDays} days`)}{row("Country", d.country)}{row("HTTPS", d.https === null ? null : d.https ? "Yes" : "No")}</dl>
        </ReportSection>
        <ReportSection icon={ArrowRight} title="Redirects">
          {r.redirects.length === 0 ? <p className="text-sm text-muted-foreground">No redirects detected.</p> : (
            <ol className="space-y-1.5">{r.redirects.map((u, i) => <li key={i} className="break-all font-mono text-xs text-muted-foreground"><span className="text-cyan">{i + 1}.</span> {u}</li>)}</ol>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

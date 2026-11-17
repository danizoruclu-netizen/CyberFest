import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, FileSearch, Link2, ListChecks, Newspaper, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { StepList } from "@/components/common/StepList";
import { ReportSection } from "@/components/common/DemoNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { delay } from "@/lib/local/forensics-shared";
import { analyzeTextWithFallback } from "@/lib/local/text-runner";
import type { TextAnalysisResult } from "@/lib/local/text-forensics";

export const Route = createFileRoute("/fake-news")({
  head: () => ({
    meta: [
      { title: "Fake News Detection — TRUTHGUARD AI" },
      { name: "description", content: "Review articles, headlines and claims for misleading content with TRUTHGUARD AI." },
      { property: "og:title", content: "Fake News Detection — TRUTHGUARD AI" },
      { property: "og:description", content: "Review articles, headlines and claims for misleading content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FakeNewsPage,
});

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: TextAnalysisResult };

const VERDICT = {
  likely_reliable: { tone: "success" as const, label: "Fewer red flags", text: "text-success" },
  mixed: { tone: "pending" as const, label: "Needs a second look", text: "text-primary-glow" },
  high_risk: { tone: "danger" as const, label: "High-risk patterns", text: "text-destructive" },
};

function FakeNewsPage() {
  const [articleUrl, setArticleUrl] = useState("");
  const [text, setText] = useState("");
  const [run, setRun] = useState<Run>({ status: "idle" });
  const reportRef = useRef<HTMLDivElement>(null);
  const running = run.status === "running";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !articleUrl.trim()) return;
    setRun({ status: "running" });
    await delay(260);
    const result = await analyzeTextWithFallback(text, articleUrl.trim() || undefined);
    setRun({ status: "done", result });
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <PageHeader
        eyebrow="Module 02"
        icon={Newspaper}
        title="Fake News Detection"
        description="Paste an article link or text to review its claims, sources and tone."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="space-y-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="article-url">Article link <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="article-url" value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} placeholder="https://example.com/news/story" className="h-11 rounded-xl bg-glass pl-9" disabled={running} inputMode="url" />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or paste text <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-text">Article or claim</Label>
              <Textarea id="article-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the headline or article text here…" className="rounded-xl bg-glass" disabled={running} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge tone="info"><Sparkles className="h-3 w-3" /> Text analysis ready</StatusBadge>
              <Button variant="hero" type="submit" disabled={running || (!text.trim() && !articleUrl.trim())}>
                {running ? "Analysing…" : <><ShieldCheck className="h-4 w-4" /> Analyse content</>}
              </Button>
            </div>
          </form>
        </GlassCard>
        <GlassCard>
          <h2 className="mb-5 text-sm font-semibold text-foreground">What we will check</h2>
          <StepList
            steps={[
              { title: "Claim extraction", description: "Identify the key factual statements being made." },
              { title: "Source credibility", description: "Look at the publisher, author and cited references." },
              { title: "Language signals", description: "Flag sensational, emotional or manipulative wording." },
            ]}
          />
        </GlassCard>
      </div>

      <div className="mt-6">
        <GlassCard ref={reportRef} className="scroll-mt-24 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Analysis report</h2>
            {run.status === "done" ? <StatusBadge tone="success">Analysis complete</StatusBadge> : <StatusBadge tone="muted">Awaiting input</StatusBadge>}
          </div>
          {run.status === "idle" && <EmptyState icon={FileSearch} title="No analysis yet" description="Paste a headline or article and press Analyse content. Your report will appear here." />}
          {run.status === "running" && <div className="p-6"><div className="h-1.5 animate-indeterminate rounded-full bg-gradient-primary" /></div>}
          {run.status === "done" && (
            <div className="animate-fade-up space-y-5 p-5 pt-4 sm:p-6 sm:pt-4">
              <div className="grid gap-5 sm:grid-cols-3">
                <ReportSection icon={Sparkles} title="Credibility score">
                  <p className={`font-display text-3xl font-bold ${VERDICT[run.result.verdict].text}`}>{run.result.credibilityScore}<span className="text-base text-muted-foreground">/100</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Heuristic score — higher means fewer red flags, not a fact-check.</p>
                </ReportSection>
                <ReportSection icon={ShieldCheck} title="Assessment">
                  <StatusBadge tone={VERDICT[run.result.verdict].tone}>{VERDICT[run.result.verdict].label}</StatusBadge>
                  <p className="mt-2 text-xs text-muted-foreground">{run.result.stats.words} words · {run.result.stats.sentences} sentences</p>
                </ReportSection>
                <ReportSection icon={ListChecks} title="Writing signals">
                  <p className="text-sm text-muted-foreground">ALL CAPS {run.result.stats.uppercaseRatio}% · {run.result.stats.exclamations} exclamations · {run.result.stats.sourceMentions} attributions</p>
                </ReportSection>
              </div>
              <ReportSection icon={AlertTriangle} title={`Signals (${run.result.signals.length})`}>
                <ul className="space-y-2">
                  {run.result.signals.map((s, i) => (
                    <li key={i} className="rounded-lg border border-glass-border bg-background/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-foreground">{s.label}</span><StatusBadge tone={s.severity === "high" ? "danger" : s.severity === "medium" ? "pending" : "info"}>{s.severity}</StatusBadge></div>
                      {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                    </li>
                  ))}
                </ul>
              </ReportSection>
              {run.result.linkFindings.length > 0 && (
                <ReportSection icon={Link2} title="Link checks">
                  <ul className="space-y-1.5">{run.result.linkFindings.map((f, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />{f.label}: {f.description}</li>)}</ul>
                </ReportSection>
              )}
              <ReportSection icon={Newspaper} title="Detailed explanation">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{run.result.summary}</p>
              </ReportSection>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileSearch,
  Image as ImageIcon,
  Newspaper,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import heroShield from "@/assets/hero-shield.jpg";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StepList } from "@/components/common/StepList";
import { SLOGAN } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { DashboardStats, RecentActivity } from "@/components/common/DashboardActivity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TRUTHGUARD AI" },
      {
        name: "description",
        content: "Your TRUTHGUARD AI workspace for checking deepfakes, manipulated videos and misleading news.",
      },
      { property: "og:title", content: "Dashboard — TRUTHGUARD AI" },
      { property: "og:description", content: SLOGAN },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const QUICK_ACTIONS = [
  {
    to: "/deepfake" as const,
    icon: ScanFace,
    title: "Check an Image or Video",
    description: "Upload media to look for face swaps, synthetic generation and editing traces.",
  },
  {
    to: "/fake-news" as const,
    icon: Newspaper,
    title: "Verify News",
    description: "Paste an article or headline to review it for misleading or false claims.",
  },
  {
    to: "/verify" as const,
    icon: ShieldCheck,
    title: "Full Verification",
    description: "Combine media and text checks into a single, shareable verification report.",
  },
];

type DemoStatus = "Verified" | "Flagged" | "Inconclusive";

const DEMO_ACTIVITY: {
  name: string;
  type: string;
  date: string;
  status: DemoStatus;
  score: number;
}[] = [
  { name: "campaign-speech-clip.mp4", type: "Video deepfake", date: "Nov 16, 2026", status: "Flagged", score: 23 },
  { name: "breaking-news-headline.txt", type: "News verification", date: "Nov 15, 2026", status: "Verified", score: 91 },
  { name: "profile-photo.jpg", type: "Image deepfake", date: "Nov 14, 2026", status: "Verified", score: 87 },
  { name: "viral-interview.mp4", type: "Full verification", date: "Nov 12, 2026", status: "Inconclusive", score: 54 },
  { name: "election-claim-article.txt", type: "News verification", date: "Nov 10, 2026", status: "Flagged", score: 31 },
];

const STATUS_TONE: Record<DemoStatus, "success" | "pending" | "muted"> = {
  Verified: "success",
  Flagged: "pending",
  Inconclusive: "muted",
};

const HOW_IT_WORKS = [
  {
    title: "Submit your content",
    description: "Upload an image or video, or paste a news article, headline or claim you want to check.",
  },
  {
    title: "Local analysis runs",
    description: "TRUTHGUARD AI measures real signals in your file or text on this device — nothing is uploaded.",
  },
  {
    title: "Get your TruthScore",
    description: "Receive a clear verdict with a TruthScore and a breakdown you can review and share.",
  },
];

function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-primary-glow";
  return "text-destructive";
}

function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="glass-card grid animate-fade-up overflow-hidden lg:grid-cols-[1.15fr_1fr]">
        <div className="relative z-10 flex flex-col justify-center p-7 sm:p-10">
          <StatusBadge tone="info" className="self-start">
            <Sparkles className="h-3 w-3" /> AI media verification
          </StatusBadge>
          <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] sm:text-4xl xl:text-5xl">
            <span className="text-foreground">Welcome to</span>{" "}
            <span className="text-gradient">TruthGuard AI</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Your digital truth verification assistant. {SLOGAN}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/verify">
                Start a verification <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link to="/about">About TRUTHGUARD AI</Link>
            </Button>
          </div>
        </div>
        <div className="relative min-h-56 lg:min-h-full">
          <img
            src={heroShield}
            alt="Holographic shield with a verification check mark"
            width={1280}
            height={960}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-background/70" />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <div className="mb-4">
          <div className="eyebrow">Quick actions</div>
          <h2 className="mt-1 text-xl font-bold text-foreground">What would you like to check?</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {QUICK_ACTIONS.map((a, i) => (
            <Link
              key={a.to}
              to={a.to}
              className="glass-card group flex animate-fade-up flex-col p-6 transition-all hover:-translate-y-1 hover:border-cyan/30 hover:shadow-glow"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <a.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {a.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
                Open
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Statistics */}
      <DashboardStats />

      {/* Recent activity */}
      <GlassCard className="animate-fade-up p-0" style={{ animationDelay: "300ms" }}>
        <RecentActivity demoTable={
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-glass-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">File / article</th>
                <th className="px-4 py-3 font-medium">Analysis type</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">TruthScore</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ACTIVITY.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-glass-border/50 last:border-0 hover:bg-glass/50"
                >
                  <td className="max-w-56 truncate px-6 py-3.5 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{row.type}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{row.date}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge tone={STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={cn("font-mono text-sm font-semibold", scoreColor(row.score))}>
                      {row.score}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        } />
      </GlassCard>

      {/* How it works */}
      <section className="grid animate-fade-up gap-6 lg:grid-cols-[1fr_1.2fr]" style={{ animationDelay: "380ms" }}>
        <div className="flex flex-col justify-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-1 text-xl font-bold text-foreground">
            From upload to verdict in three steps
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            TRUTHGUARD AI combines deepfake detection, manipulation analysis and news verification
            into one workflow, so you can check what you see before you share it.
          </p>
          <Button asChild variant="glass" className="mt-6 self-start">
            <Link to="/about">
              Learn more <ArrowRight />
            </Link>
          </Button>
        </div>
        <GlassCard>
          <StepList steps={HOW_IT_WORKS} />
        </GlassCard>
      </section>
    </div>
  );
}

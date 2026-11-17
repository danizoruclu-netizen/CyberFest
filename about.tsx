import { createFileRoute } from "@tanstack/react-router";
import { Eye, Info, Lock, Scale, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { GlassCard } from "@/components/common/GlassCard";
import { LogoMark } from "@/components/brand/Logo";
import { SLOGAN } from "@/components/layout/nav-items";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — TRUTHGUARD AI" },
      { name: "description", content: "Why TRUTHGUARD AI exists and the principles behind how it verifies media and news." },
      { property: "og:title", content: "About — TRUTHGUARD AI" },
      { property: "og:description", content: SLOGAN },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const PRINCIPLES = [
  { icon: Eye, title: "Transparent", description: "Reports explain what was checked and why, not just a score." },
  { icon: Scale, title: "Careful", description: "Results are guidance to help you decide — never a final judgement." },
  { icon: Lock, title: "Private", description: "Your uploads are treated as yours and handled with care." },
  { icon: ShieldCheck, title: "Focused", description: "Built for one job: helping people stop misinformation from spreading." },
];

function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="Our mission" icon={Info} title="About TRUTHGUARD AI" />
      <GlassCard className="relative mb-6 overflow-hidden p-8 sm:p-10">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <LogoMark className="h-20 w-20 shrink-0 animate-float" />
          <div>
            <p className="font-display text-xl font-bold leading-snug text-gradient sm:text-2xl">{SLOGAN}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Fake images, edited videos and misleading stories travel faster than ever. TRUTHGUARD AI
              gives everyone a simple place to check what they see before they believe it — or pass it on.
            </p>
          </div>
        </div>
      </GlassCard>
      <div className="grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((p) => (
          <GlassCard key={p.title} className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan/25 bg-primary/15 text-cyan">
              <p.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

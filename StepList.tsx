type Step = { title: string; description: string };

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/25 bg-primary/15 font-mono text-xs font-semibold text-cyan">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{step.title}</div>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

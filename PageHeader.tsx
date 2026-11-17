import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, icon: Icon, actions }: Props) {
  return (
    <div className="mb-8 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan/25 bg-primary/15 text-cyan shadow-glow sm:flex">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

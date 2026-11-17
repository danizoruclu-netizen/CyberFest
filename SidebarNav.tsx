import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      <div className="eyebrow mb-2 px-3 text-muted-foreground">Navigation</div>
      {NAV_ITEMS.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-primary" />
            )}
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                active
                  ? "border-cyan/30 bg-primary/20 text-cyan"
                  : "border-glass-border bg-glass text-muted-foreground group-hover:text-cyan",
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

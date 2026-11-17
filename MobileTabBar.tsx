import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

const SHORT: Record<string, string> = {
  "/": "Home",
  "/deepfake": "Deepfake",
  "/fake-news": "News",
  "/verify": "Verify",
  "/history": "History",
};

/** Bottom tab bar for phones; About stays reachable from the menu drawer. */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((i) => i.to in SHORT);

  return (
    <nav
      aria-label="Quick navigation"
      className="glass-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-cyan" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            {SHORT[item.to]}
          </Link>
        );
      })}
    </nav>
  );
}

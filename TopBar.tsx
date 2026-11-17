import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS } from "./nav-items";
import { SidebarNav } from "./SidebarNav";
import { SystemStatusCard } from "./SystemStatusCard";

export function TopBar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    NAV_ITEMS.find((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to))) ??
    NAV_ITEMS[0]!;

  return (
    <header className="glass-bar sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
      <Button
        variant="glass"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>

      <Link to="/" className="lg:hidden" aria-label="TRUTHGUARD AI home">
        <Logo />
      </Link>

      <div className="hidden min-w-0 flex-col lg:flex">
        <span className="eyebrow text-muted-foreground">TruthGuard / {current.title}</span>
        <span className="truncate text-sm text-muted-foreground">{current.description}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-input bg-glass px-3 py-2 text-sm text-muted-foreground md:flex md:w-64">
          <Search className="h-4 w-4" />
          <span className="truncate">Search verifications…</span>
          <kbd className="ml-auto rounded border border-input px-1.5 font-mono text-[10px]">⌘K</kbd>
        </div>
        <Button variant="glass" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary font-display text-xs font-bold text-primary-foreground">
          TG
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="glass-bar flex w-80 flex-col border-r p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Move between TRUTHGUARD AI sections</SheetDescription>
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 py-5">
            <SidebarNav onNavigate={() => setOpen(false)} />
            <SystemStatusCard />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

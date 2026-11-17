import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "./SidebarNav";
import { SystemStatusCard } from "./SystemStatusCard";

export function AppSidebar() {
  return (
    <aside className="glass-bar fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link to="/" aria-label="TRUTHGUARD AI home">
          <Logo />
        </Link>
      </div>
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 py-5">
        <SidebarNav />
        <SystemStatusCard />
      </div>
    </aside>
  );
}

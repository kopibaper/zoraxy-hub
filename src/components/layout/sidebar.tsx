"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  FileCode2,
  Layers,
  ScrollText,
  Settings,
  LogOut,
  Hexagon,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nodes", label: "Nodes", icon: Server },
  { href: "/templates", label: "Templates", icon: FileCode2 },
  { href: "/bulk", label: "Bulk Operations", icon: Layers },
  { href: "/agent-install", label: "Agent Installer", icon: Terminal },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, username } = useAuth();

  const content = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-md-outline-variant px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl primary-gradient elevation-1">
          <Hexagon className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-md-on-surface">ZoraxyHub</span>
          <p className="text-[11px] font-medium text-md-on-surface-variant">Management Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-md-primary-container text-md-on-primary-container"
                  : "text-md-on-surface-variant hover:bg-md-surface-container hover:text-md-on-surface"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-md-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-md-outline-variant p-3">
        <div className="flex items-center justify-between rounded-xl px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-md-primary-container text-xs font-semibold text-md-primary">
              {(username || "A")[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium text-md-on-surface">
              {username || "admin"}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              onMobileClose?.();
            }}
            className="rounded-xl p-2 text-md-on-surface-variant transition-all hover:bg-md-error-container hover:text-md-on-error-container"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-[272px] shrink-0 border-r border-md-outline-variant bg-md-surface md:flex md:flex-col">
        {content}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-md-on-surface/30 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-md-outline-variant bg-md-surface elevation-4 transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}

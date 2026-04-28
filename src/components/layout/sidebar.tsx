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
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Hexagon className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold tracking-tight">ZoraxyHub</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {username || "admin"}
          </span>
          <button
            onClick={() => {
              logout();
              onMobileClose?.();
            }}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        {content}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform md:hidden dark:border-zinc-800 dark:bg-zinc-950",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}

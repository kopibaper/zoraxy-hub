"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/nodes": "Nodes",
  "/templates": "Templates",
  "/bulk": "Bulk Operations",
  "/audit": "Audit Log",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/nodes/new")) return "Add Node";
  if (pathname.match(/^\/nodes\/[^/]+$/)) return "Node Details";
  if (pathname.includes("/proxies")) return "Proxy Rules";
  if (pathname.includes("/certs")) return "Certificates";
  if (pathname.includes("/stats")) return "Statistics";
  if (pathname.includes("/templates/")) return "Template Details";
  return "ZoraxyHub";
}

interface HeaderProps {
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Header({ onMenuClick, isMobileMenuOpen = false }: HeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-2 md:hidden"
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        onClick={onMenuClick}
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}

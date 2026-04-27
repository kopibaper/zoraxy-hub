"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/app-shell";
import { NodeCard } from "@/components/nodes/node-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useNodes } from "@/hooks/use-nodes";

export default function NodesPage() {
  const { data: nodes, isLoading } = useNodes();
  const [search, setSearch] = useState("");

  const filtered = nodes?.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.host.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Nodes</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Manage your Zoraxy instances
            </p>
          </div>
          <Link href="/nodes/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add Node
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search nodes by name, host, or tag..."
            data-search-input="nodes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Server}
            title="No nodes found"
            description={
              search
                ? "Try a different search term"
                : "Add your first Zoraxy node to get started"
            }
            actionLabel={search ? undefined : "Add Node"}
            actionHref={search ? undefined : "/nodes/new"}
          />
        )}
      </div>
    </AppShell>
  );
}

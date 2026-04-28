"use client";

import Link from "next/link";
import { Server, MapPin, Clock, Tag, Cpu, MemoryStick } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NodeStatusBadge } from "./node-status-badge";
import { Badge } from "@/components/ui/badge";
import type { Node } from "@/types/node";
import type { NodeStats } from "@/hooks/use-nodes";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function UsageBar({
  label,
  icon: Icon,
  value,
  detail,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | null;
  detail?: string;
}) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
          <span className="text-xs font-medium tabular-nums">
            {pct.toFixed(1)}%
            {detail && (
              <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                {detail}
              </span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function getCpuDetail(stats?: NodeStats): string | undefined {
  if (!stats?.cpuCount) return undefined;
  return `(${stats.cpuCount} cores)`;
}

function getMemDetail(stats?: NodeStats): string | undefined {
  if (stats?.memoryUsed == null || stats?.memoryTotal == null) return undefined;
  return `(${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)})`;
}

export function NodeCard({ node, stats }: { node: Node; stats?: NodeStats }) {
  return (
    <Link href={`/nodes/${node.id}`}>
      <Card className="transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Server className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-semibold">{node.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {node.host}:{node.port}
                </p>
              </div>
            </div>
            <NodeStatusBadge status={node.status} />
          </div>

          <div className="mt-4 space-y-2">
            <UsageBar
              label="CPU"
              icon={Cpu}
              value={stats?.cpu ?? null}
              detail={getCpuDetail(stats)}
            />
            <UsageBar
              label="MEM"
              icon={MemoryStick}
              value={stats?.memory ?? null}
              detail={getMemDetail(stats)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {node.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {node.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(node.lastSeen)}
            </span>
            <Badge variant="outline" className="text-xs">
              {node.connectionMode}
            </Badge>
          </div>

          {node.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

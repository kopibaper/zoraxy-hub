"use client";

import Link from "next/link";
import { Server, MapPin, Clock, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NodeStatusBadge } from "./node-status-badge";
import { Badge } from "@/components/ui/badge";
import type { Node } from "@/types/node";

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

export function NodeCard({ node }: { node: Node }) {
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

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
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

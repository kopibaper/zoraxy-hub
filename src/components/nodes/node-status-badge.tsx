"use client";

import { Badge } from "@/components/ui/badge";
import type { NodeStatus } from "@/types/node";

const statusConfig: Record<
  NodeStatus,
  { label: string; variant: "success" | "danger" | "warning" | "secondary" }
> = {
  online: { label: "Online", variant: "success" },
  offline: { label: "Offline", variant: "danger" },
  degraded: { label: "Degraded", variant: "warning" },
  unknown: { label: "Unknown", variant: "secondary" },
};

export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

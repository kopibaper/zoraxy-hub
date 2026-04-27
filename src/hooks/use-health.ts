"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useApi } from "./use-api";

interface HealthPollResult {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "unknown";
  stats: unknown | null;
  netstat: unknown | null;
  checkedAt: string;
}

interface HealthSnapshot {
  id: string;
  nodeId: string;
  snapshotType: "proxy_rules" | "certs" | "full_config";
  data: {
    status: "online" | "offline" | "degraded" | "unknown";
    stats: unknown | null;
    netstat: unknown | null;
    checkedAt: string;
  } | null;
  createdAt: string;
}

export function useHealthCheck() {
  const api = useApi();

  return useMutation({
    mutationFn: () => api.get<HealthPollResult[]>("/api/v1/health"),
  });
}

export function useHealthHistory(nodeId?: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["health", "history", nodeId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (nodeId) {
        params.set("nodeId", nodeId);
      }

      const query = params.toString();
      return api.get<HealthSnapshot[]>(
        query ? `/api/v1/health/history?${query}` : "/api/v1/health/history"
      );
    },
  });
}

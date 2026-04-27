"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";

export interface DockerStatus {
  status: "running" | "stopped" | "not_found";
  id?: string;
  image?: string;
  startedAt?: string;
}

export function useDockerStatus(nodeId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "docker", "status"],
    queryFn: () => api.get<DockerStatus>(`/api/v1/nodes/${nodeId}/docker`),
    enabled: !!nodeId,
    refetchInterval: 10000,
  });
}

export function useDockerRestart(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(`/api/v1/nodes/${nodeId}/docker/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", nodeId, "docker"] });
    },
  });
}

export function useDockerStop(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(`/api/v1/nodes/${nodeId}/docker/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", nodeId, "docker"] });
    },
  });
}

export function useDockerStart(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(`/api/v1/nodes/${nodeId}/docker/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", nodeId, "docker"] });
    },
  });
}

export function useDockerLogs(nodeId: string, tail: number) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "docker", "logs", tail],
    queryFn: () =>
      api.get<{ logs: string }>(`/api/v1/nodes/${nodeId}/docker/logs?tail=${tail}`),
    enabled: !!nodeId,
    refetchInterval: 10000,
  });
}

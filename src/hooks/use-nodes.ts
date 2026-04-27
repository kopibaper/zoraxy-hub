"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import type { Node, NodeHealth } from "@/types/node";

export function useNodes() {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.get<Node[]>("/api/v1/nodes"),
    refetchInterval: 30000,
  });
}

export function useNode(id: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", id],
    queryFn: () => api.get<Node>(`/api/v1/nodes/${id}`),
    enabled: !!id,
  });
}

export function useNodeHealth(id: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", id, "health"],
    queryFn: () => api.get<NodeHealth>(`/api/v1/nodes/${id}/health`),
    enabled: !!id,
    refetchInterval: 60000,
  });
}

export function useCreateNode() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Node>("/api/v1/nodes", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });
}

export function useUpdateNode() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.put<Node>(`/api/v1/nodes/${id}`, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
      queryClient.invalidateQueries({ queryKey: ["nodes", variables.id] });
    },
  });
}

export function useDeleteNode() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/api/v1/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });
}

export function useTestNode() {
  const api = useApi();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ connected: boolean; testedAt: string }>(
        `/api/v1/nodes/${id}/test`
      ),
  });
}

export function useTestConnection() {
  const api = useApi();

  return useMutation({
    mutationFn: (params: {
      connectionMode?: string;
      host: string;
      port: number;
      protocol: string;
      authMethod: string;
      username?: string;
      password?: string;
      agentToken?: string;
      agentPort?: number;
      agentTls?: boolean;
    }) =>
      api.post<{ connected: boolean; testedAt: string }>(
        "/api/v1/nodes/test-connection",
        params
      ),
  });
}

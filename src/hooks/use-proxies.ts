"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import type { ZoraxyOrigin, ZoraxyProxyEntry } from "@/lib/zoraxy/types";

export function useProxyRules(nodeId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "proxies"],
    queryFn: () =>
      api.get<ZoraxyProxyEntry[]>(`/api/v1/nodes/${nodeId}/proxies`),
    enabled: !!nodeId,
  });
}

export function useProxyDetail(nodeId: string, domain: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "proxies", domain],
    queryFn: () =>
      api.get<ZoraxyProxyEntry>(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}`
      ),
    enabled: !!nodeId && !!domain,
  });
}

export function useUpstreams(nodeId: string, domain: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "proxies", domain, "upstreams"],
    queryFn: () =>
      api.get<ZoraxyOrigin[]>(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}/upstreams`
      ),
    enabled: !!nodeId && !!domain,
  });
}

export function useAddProxyRule(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post(`/api/v1/nodes/${nodeId}/proxies`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies"],
      });
    },
  });
}

export function useDeleteProxyRule(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domain: string) =>
      api.del(`/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies"],
      });
    },
  });
}

export function useToggleProxyRule(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ domain, enabled }: { domain: string; enabled: boolean }) =>
      api.patch(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}/toggle`,
        { enabled }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies"],
      });
    },
  });
}

export function useEditProxyRule(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      domain,
      updates,
    }: {
      domain: string;
      updates: Record<string, unknown>;
    }) =>
      api.put(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}`,
        updates
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies"],
      });
    },
  });
}

export function useEditProxyRuleForDomain(nodeId: string, domain: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.put(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies", domain],
      });
    },
  });
}

export function useAddUpstream(nodeId: string, domain: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      origin: string;
      requireTLS: boolean;
      skipCertValidation: boolean;
      weight: number;
    }) =>
      api.post(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}/upstreams`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies", domain],
      });
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies", domain, "upstreams"],
      });
    },
  });
}

export function useRemoveUpstream(nodeId: string, domain: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { origin: string }) =>
      api.del(
        `/api/v1/nodes/${nodeId}/proxies/${encodeURIComponent(domain)}/upstreams`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies", domain],
      });
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "proxies", domain, "upstreams"],
      });
    },
  });
}

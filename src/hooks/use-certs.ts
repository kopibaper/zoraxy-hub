"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import type { ZoraxyCertInfo } from "@/lib/zoraxy/types";

export function useCerts(nodeId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "certs"],
    queryFn: () => api.get<ZoraxyCertInfo[]>(`/api/v1/nodes/${nodeId}/certs`),
    enabled: !!nodeId,
  });
}

export function useDeleteCert(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domain: string) =>
      api.del(`/api/v1/nodes/${nodeId}/certs`, { domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "certs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "certs", "autorenew"],
      });
    },
  });
}

export function useObtainACME(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { domains: string[]; email: string }) =>
      api.post(`/api/v1/nodes/${nodeId}/certs/acme`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "certs"],
      });
    },
  });
}

export function useUploadCert(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { domain: string; certPem: string; keyPem: string }) =>
      api.post(`/api/v1/nodes/${nodeId}/certs`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "certs"],
      });
    },
  });
}

export function useAutoRenewDomains(nodeId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "certs", "autorenew"],
    queryFn: () =>
      api.get<string[]>(`/api/v1/nodes/${nodeId}/certs/autorenew`),
    enabled: !!nodeId,
  });
}

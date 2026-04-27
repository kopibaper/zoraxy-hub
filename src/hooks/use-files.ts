"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";

export interface ConfigFileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

export function useFileList(nodeId: string, path: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "files", "list", path],
    queryFn: () =>
      api.get<ConfigFileEntry[]>(
        `/api/v1/nodes/${nodeId}/files?path=${encodeURIComponent(path)}`
      ),
    enabled: !!nodeId,
  });
}

export function useFileContent(nodeId: string, path?: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["nodes", nodeId, "files", "content", path],
    queryFn: () =>
      api.get<{ path: string; content: string }>(
        `/api/v1/nodes/${nodeId}/files/read?path=${encodeURIComponent(path || "")}`
      ),
    enabled: !!nodeId && !!path,
  });
}

export function useWriteFile(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { path: string; content: string }) =>
      api.put(`/api/v1/nodes/${nodeId}/files/write`, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["nodes", nodeId, "files", "list"] });
      queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "files", "content", variables.path],
      });
    },
  });
}

export function useDeleteFile(nodeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { path: string }) =>
      api.del(`/api/v1/nodes/${nodeId}/files/delete`, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["nodes", nodeId, "files", "list"] });
      queryClient.removeQueries({
        queryKey: ["nodes", nodeId, "files", "content", variables.path],
      });
    },
  });
}

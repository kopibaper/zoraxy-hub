"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import type { ConfigTemplate, TemplateDeployment } from "@/types/template";

export function useTemplates() {
  const api = useApi();

  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<ConfigTemplate[]>("/api/v1/templates"),
  });
}

export function useTemplate(id: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["templates", id],
    queryFn: () => api.get<ConfigTemplate>(`/api/v1/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<ConfigTemplate>("/api/v1/templates", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.put<ConfigTemplate>(`/api/v1/templates/${id}`, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates", variables.id] });
    },
  });
}

export function useDeleteTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/api/v1/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useDeployTemplate(templateId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { nodeIds: string[]; variables?: Record<string, string> }) =>
      api.post<{
        templateId: string;
        results: Array<{
          nodeId: string;
          success: boolean;
          status: "pending" | "deploying" | "deployed" | "failed" | "outdated";
          error: string | null;
          deployedAt: string | null;
          deploymentId: string;
        }>;
        deployments: TemplateDeployment[];
      }>(`/api/v1/templates/${templateId}/deploy/execute`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["templates", templateId, "deployments"],
      });
    },
  });
}

export function useTemplateDeployments(templateId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["templates", templateId, "deployments"],
    queryFn: () =>
      api.get<TemplateDeployment[]>(
        `/api/v1/templates/${templateId}/deploy`
      ),
    enabled: !!templateId,
  });
}

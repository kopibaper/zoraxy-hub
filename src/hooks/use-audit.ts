"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "./use-api";
import type { AuditLogEntry } from "@/types/api";

export function useAuditLog(params?: {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
}) {
  const api = useApi();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;

  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.action) searchParams.set("action", params.action);

  return useQuery({
    queryKey: ["audit", { ...params }],
    queryFn: () =>
      api.get<{
        entries: AuditLogEntry[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/v1/audit?${searchParams.toString()}`),
  });
}

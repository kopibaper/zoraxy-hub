"use client";

import { useState } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuditLog } from "@/hooks/use-audit";

const entityTypeColors: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  node: "default",
  proxy: "success",
  cert: "warning",
  template: "secondary",
  system: "danger",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>("");
  const pageSize = 25;

  const { data, isLoading } = useAuditLog({
    page,
    pageSize,
    entityType: entityType || undefined,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Track all changes across your Zoraxy nodes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Filter:</span>
          {["", "node", "proxy", "cert", "template", "system"].map((type) => (
            <Button
              key={type}
              variant={entityType === type ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEntityType(type);
                setPage(1);
              }}
            >
              {type || "All"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : entries.length > 0 ? (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            entry.result === "success" ? "success" : "danger"
                          }
                          className="text-[10px] w-16 justify-center"
                        >
                          {entry.result}
                        </Badge>
                        <Badge
                          variant={
                            entityTypeColors[entry.entityType] ?? "secondary"
                          }
                          className="text-[10px] w-16 justify-center"
                        >
                          {entry.entityType}
                        </Badge>
                        <span className="text-sm font-medium">
                          {entry.action}
                        </span>
                        {entry.entityId && (
                          <span className="text-xs text-zinc-400 font-mono">
                            {entry.entityId.substring(0, 12)}...
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 shrink-0">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, total)} of {total} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-zinc-500 whitespace-nowrap">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title="No audit entries"
            description="Activity will be logged as you manage your nodes"
          />
        )}
      </div>
    </AppShell>
  );
}

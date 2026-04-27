"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Play, Square, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNode } from "@/hooks/use-nodes";
import {
  useDockerLogs,
  useDockerRestart,
  useDockerStart,
  useDockerStatus,
  useDockerStop,
} from "@/hooks/use-docker";

export default function DockerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const [tail, setTail] = useState("100");

  const tailNumber = useMemo(() => Number.parseInt(tail, 10) || 100, [tail]);
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useDockerStatus(id);
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } =
    useDockerLogs(id, tailNumber);

  const startDocker = useDockerStart(id);
  const stopDocker = useDockerStop(id);
  const restartDocker = useDockerRestart(id);

  const logsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!logsRef.current) return;
    logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logsData?.logs]);

  const isMutating =
    startDocker.isPending || stopDocker.isPending || restartDocker.isPending;

  const refreshAll = async () => {
    await Promise.all([refetchStatus(), refetchLogs()]);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/nodes/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Docker Management</h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                {node?.name ?? "Loading..."}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {node?.connectionMode === "direct" ? (
          <Card>
            <CardContent className="py-10 text-center text-zinc-500 dark:text-zinc-400">
              Docker management requires agent mode
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Container Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      status?.status === "running"
                        ? "success"
                        : status?.status === "stopped"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {statusLoading ? "Loading..." : status?.status ?? "unknown"}
                  </Badge>
                </div>

                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-400">ID</dt>
                    <dd className="font-mono text-sm">{status?.id || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Image</dt>
                    <dd className="text-sm">{status?.image || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                      Started At
                    </dt>
                    <dd className="text-sm">
                      {status?.startedAt
                        ? new Date(status.startedAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => startDocker.mutate()}
                    disabled={isMutating || status?.status === "running"}
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => stopDocker.mutate()}
                    disabled={isMutating || status?.status !== "running"}
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => restartDocker.mutate()}
                    disabled={isMutating}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-3">
                <CardTitle>Docker Logs</CardTitle>
                <div className="w-32">
                  <Select value={tail} onValueChange={setTail}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">Tail 50</SelectItem>
                      <SelectItem value="100">Tail 100</SelectItem>
                      <SelectItem value="500">Tail 500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <textarea
                  ref={logsRef}
                  className="h-[420px] w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  value={
                    logsLoading
                      ? "Loading logs..."
                      : logsData?.logs || "No logs available"
                  }
                  readOnly
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

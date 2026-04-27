"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  CircleSlash,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/layout/app-shell";
import { useNode } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";

type NodeStats = {
  TotalRequest: number;
  ErrorRequest: number;
  ValidRequest: number;
  ForwardTypes: Record<string, number>;
  RequestOrigin: Record<string, number>;
  RequestClientIp: Record<string, number>;
  RequestURL: Record<string, number>;
  UserAgents: Record<string, number>;
  StatusCodes: Record<string, number>;
  Referers: Record<string, number>;
};

type NetStat = {
  RX: number;
  TX: number;
};

type UptimeEntry = {
  Timestamp: number;
  ID: string;
  Name: string;
  URL: string;
  Protocol: string;
  Online: boolean;
  StatusCode: number;
  Latency: number;
};

type UptimeStats = Record<string, UptimeEntry[]>;

type SystemStats = {
  Version: string;
  NodeUUID: string;
  Development: boolean;
  BootTime: number;
  EnableSshLoopback: boolean;
  ZerotierConnected: boolean;
};

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatUptime(bootTime: number): string {
  if (!Number.isFinite(bootTime) || bootTime <= 0) return "Unknown";
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, now - bootTime);
  const days = Math.floor(elapsed / 86400);
  const hours = Math.floor((elapsed % 86400) / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatShortTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {message}
    </div>
  );
}

function LoadingPanels() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`stat-skeleton-${index}`}
            className="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={`chart-skeleton-${index}`}
            className="h-[340px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}

export default function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const api = useApi();
  const { data: node } = useNode(id);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ["nodes", id, "stats"],
    queryFn: () => api.get<NodeStats>(`/api/v1/nodes/${id}/stats`),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const { data: netstat, isLoading: netstatLoading } = useQuery({
    queryKey: ["nodes", id, "stats", "netstat"],
    queryFn: () => api.get<NetStat>(`/api/v1/nodes/${id}/stats/netstat`),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: ["nodes", id, "stats", "uptime"],
    queryFn: () => api.get<UptimeStats>(`/api/v1/nodes/${id}/stats/uptime`),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const { data: system, isLoading: systemLoading } = useQuery({
    queryKey: ["nodes", id, "stats", "system"],
    queryFn: () => api.get<SystemStats>(`/api/v1/nodes/${id}/stats/system`),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const statusDistributionData = useMemo(() => {
    const buckets = {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0,
    };

    if (!stats?.StatusCodes) return [];

    Object.entries(stats.StatusCodes).forEach(([code, count]) => {
      const numericCode = Number.parseInt(code, 10);
      if (numericCode >= 200 && numericCode < 300) buckets["2xx"] += count;
      else if (numericCode >= 300 && numericCode < 400)
        buckets["3xx"] += count;
      else if (numericCode >= 400 && numericCode < 500)
        buckets["4xx"] += count;
      else if (numericCode >= 500 && numericCode < 600)
        buckets["5xx"] += count;
    });

    return Object.entries(buckets)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [stats]);

  const forwardTypeData = useMemo(() => {
    if (!stats?.ForwardTypes) return [];
    return Object.entries(stats.ForwardTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [stats]);

  const topUrlsData = useMemo(() => {
    if (!stats?.RequestURL) return [];
    return Object.entries(stats.RequestURL)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([url, value]) => ({
        name: truncate(url, 50),
        full: url,
        value,
      }));
  }, [stats]);

  const topCountriesData = useMemo(() => {
    if (!stats?.RequestOrigin) return [];
    return Object.entries(stats.RequestOrigin)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([country, value]) => ({
        name: country.toUpperCase(),
        value,
      }));
  }, [stats]);

  const topClientIps = useMemo(() => {
    if (!stats?.RequestClientIp) return [];
    return Object.entries(stats.RequestClientIp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([ip, count]) => ({ ip, count }));
  }, [stats]);

  const uptimeDomains = useMemo(() => {
    if (!uptime) return [];

    return Object.entries(uptime)
      .map(([domain, entries]) => {
        const timeline = [...entries].sort((a, b) => a.Timestamp - b.Timestamp);
        const latest = timeline[timeline.length - 1];

        return {
          domain,
          latest,
          timeline,
          chartData: timeline.map((point) => ({
            time: formatShortTime(point.Timestamp),
            latency: point.Latency,
          })),
          statusHistory: timeline.slice(-40),
        };
      })
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }, [uptime]);

  const totalBandwidth = (netstat?.RX ?? 0) + (netstat?.TX ?? 0);
  const isInitialLoading =
    (statsLoading || netstatLoading || uptimeLoading || systemLoading) && !stats;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/nodes/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              {node?.name ?? "Loading node..."}
            </p>
          </div>
        </div>

        {isInitialLoading ? (
          <LoadingPanels />
        ) : statsError || !stats ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No statistics available</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Statistics will appear once the node is connected.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="uptime">Uptime Monitor</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Total Requests
                        </p>
                        <p className="text-xl font-bold">
                          {stats.TotalRequest.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Valid Requests
                        </p>
                        <p className="text-xl font-bold">
                          {stats.ValidRequest.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Error Requests
                        </p>
                        <p className="text-xl font-bold">
                          {stats.ErrorRequest.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <CircleSlash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Bandwidth (RX + TX)
                        </p>
                        <p className="text-xl font-bold">
                          {formatBytes(totalBandwidth)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Status Code Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusDistributionData.length === 0 ? (
                      <EmptyState message="No status code data available yet." />
                    ) : (
                      <div className="h-[300px] rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusDistributionData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              label
                            >
                              {statusDistributionData.map((entry, index) => (
                                <Cell
                                  key={`status-cell-${entry.name}`}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "1px solid #3f3f46",
                              }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Forward Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {forwardTypeData.length === 0 ? (
                      <EmptyState message="No forward type data available yet." />
                    ) : (
                      <div className="h-[300px] rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={forwardTypeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis dataKey="name" stroke="#a1a1aa" />
                            <YAxis stroke="#a1a1aa" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "1px solid #3f3f46",
                              }}
                            />
                            <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>System Info</CardTitle>
                </CardHeader>
                <CardContent>
                  {system ? (
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                          Version
                        </dt>
                        <dd className="mt-1 font-medium">{system.Version || "Unknown"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                          Uptime
                        </dt>
                        <dd className="mt-1 font-medium">
                          {formatUptime(system.BootTime)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                          Node UUID
                        </dt>
                        <dd className="mt-1 font-mono text-sm break-all">
                          {system.NodeUUID || "Unknown"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <EmptyState message="System information is not available." />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="traffic" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Request URLs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topUrlsData.length === 0 ? (
                      <EmptyState message="No URL request data available yet." />
                    ) : (
                      <div className="h-[420px] rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topUrlsData} layout="vertical" margin={{ left: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis type="number" stroke="#a1a1aa" />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={220}
                              stroke="#a1a1aa"
                            />
                            <Tooltip
                              labelFormatter={(_, payload) => {
                                const item = payload?.[0]?.payload as
                                  | { full?: string }
                                  | undefined;
                                return item?.full ?? "URL";
                              }}
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "1px solid #3f3f46",
                              }}
                            />
                            <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Request Origin by Country</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topCountriesData.length === 0 ? (
                      <EmptyState message="No country origin data available yet." />
                    ) : (
                      <div className="h-[420px] rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topCountriesData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis dataKey="name" stroke="#a1a1aa" />
                            <YAxis stroke="#a1a1aa" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "1px solid #3f3f46",
                              }}
                            />
                            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Client IPs</CardTitle>
                </CardHeader>
                <CardContent>
                  {topClientIps.length === 0 ? (
                    <EmptyState message="No client IP data available yet." />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-100 dark:bg-zinc-900">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                              IP Address
                            </th>
                            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                              Requests
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {topClientIps.map((entry) => (
                            <tr
                              key={entry.ip}
                              className="border-t border-zinc-200 dark:border-zinc-800"
                            >
                              <td className="px-4 py-3 font-mono">{entry.ip}</td>
                              <td className="px-4 py-3 text-right">
                                {entry.count.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="uptime" className="space-y-4">
              {uptimeLoading && uptimeDomains.length === 0 ? (
                <LoadingPanels />
              ) : uptimeDomains.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <EmptyState message="No uptime monitor data available." />
                  </CardContent>
                </Card>
              ) : (
                uptimeDomains.map((monitor) => (
                  <Card key={monitor.domain}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base font-semibold">
                          {monitor.domain}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={monitor.latest?.Online ? "success" : "danger"}>
                            {monitor.latest?.Online ? "Online" : "Offline"}
                          </Badge>
                          <Badge variant="secondary">
                            Latest latency: {monitor.latest?.Latency ?? 0} ms
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {monitor.chartData.length === 0 ? (
                        <EmptyState message="No latency timeline data available." />
                      ) : (
                        <div className="h-[280px] rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monitor.chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                              <XAxis dataKey="time" stroke="#a1a1aa" />
                              <YAxis stroke="#a1a1aa" unit="ms" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#18181b",
                                  border: "1px solid #3f3f46",
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="latency"
                                stroke="#a855f7"
                                fill="#a855f7"
                                fillOpacity={0.25}
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-sm font-medium">Status History</p>
                        {monitor.statusHistory.length === 0 ? (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            No recent status checks.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {monitor.statusHistory.map((point, index) => (
                              <span
                                key={`${monitor.domain}-${point.Timestamp}-${index}`}
                                className={`h-3 w-3 rounded-full ${
                                  point.Online ? "bg-emerald-500" : "bg-red-500"
                                }`}
                                title={`${new Date(
                                  point.Timestamp * 1000
                                ).toLocaleString()} - ${
                                  point.Online ? "Online" : "Offline"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Raw Stats Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-[70vh] overflow-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
                    {JSON.stringify(
                      {
                        stats,
                        netstat,
                        uptime,
                        system,
                      },
                      null,
                      2
                    )}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

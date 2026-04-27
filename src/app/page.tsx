"use client";

import Link from "next/link";
import {
  Server,
  Globe,
  Lock,
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { useNodes } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import type { SystemOverview } from "@/types/api";

type TrafficOverview = SystemOverview & {
  totalRequests?: number;
  totalBandwidth?: number;
  requestOrigin?: Record<string, number>;
  RequestOrigin?: Record<string, number>;
  statusCodeDistribution?:
    | Record<string, number>
    | Array<{ code: string | number; count: number }>;
  bandwidthByNode?: Array<{
    nodeId?: string;
    nodeName?: string;
    name?: string;
    rx?: number;
    tx?: number;
    rxBytes?: number;
    txBytes?: number;
  }>;
  trafficSummary?: {
    totalRequests?: number;
    totalBandwidth?: number;
    countryDistribution?: { country: string; count: number }[];
    requestOrigin?: Record<string, number>;
    statusCodeDistribution?:
      | Record<string, number>
      | Array<{ code: string | number; count: number }>;
    bandwidthByNode?: Array<{
      nodeId?: string;
      nodeName?: string;
      name?: string;
      rx?: number;
      tx?: number;
      rxBytes?: number;
      txBytes?: number;
    }>;
  };
};

const STATUS_COLORS = {
  "2xx": "#10b981",
  "3xx": "#3b82f6",
  "4xx": "#f59e0b",
  "5xx": "#ef4444",
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toFixed(index >= 2 ? 2 : 0)} ${units[index]}`;
}

function formatLastSeen(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
      {message}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "text-zinc-600 dark:text-zinc-400",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 ${colors[variant]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: nodes } = useNodes();
  const api = useApi();

  const { data: overview } = useQuery({
    queryKey: ["system", "overview"],
    queryFn: () => api.get<SystemOverview>("/api/v1/system"),
    refetchInterval: 30000,
  });

  const totalNodes = nodes?.length ?? 0;
  const onlineNodes =
    nodes?.filter((n) => n.status === "online").length ?? 0;
  const offlineNodes =
    nodes?.filter((n) => n.status === "offline").length ?? 0;
  const degradedNodes =
    nodes?.filter((n) => n.status === "degraded").length ?? 0;

  const trafficOverview = overview as TrafficOverview | undefined;

  const requestOriginMap =
    trafficOverview?.trafficSummary?.requestOrigin ??
    trafficOverview?.requestOrigin ??
    trafficOverview?.RequestOrigin ??
    {};

  const requestDistribution = Object.entries(requestOriginMap)
    .map(([country, requests]) => ({ country, requests: Number(requests) || 0 }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  const rawStatusDistribution =
    trafficOverview?.trafficSummary?.statusCodeDistribution ??
    trafficOverview?.statusCodeDistribution ??
    {};

  const statusBuckets = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };

  if (Array.isArray(rawStatusDistribution)) {
    rawStatusDistribution.forEach((entry) => {
      const numericCode = Number(entry.code);
      const count = Number(entry.count) || 0;

      if (Number.isFinite(numericCode)) {
        const key = `${Math.floor(numericCode / 100)}xx` as keyof typeof statusBuckets;
        if (key in statusBuckets) {
          statusBuckets[key] += count;
        }
      }
    });
  } else {
    Object.entries(rawStatusDistribution).forEach(([key, value]) => {
      const count = Number(value) || 0;
      if (/^[2-5]xx$/i.test(key)) {
        const bucket = key.toLowerCase() as keyof typeof statusBuckets;
        statusBuckets[bucket] += count;
        return;
      }

      const numericCode = Number(key);
      if (Number.isFinite(numericCode)) {
        const bucket = `${Math.floor(numericCode / 100)}xx` as keyof typeof statusBuckets;
        if (bucket in statusBuckets) {
          statusBuckets[bucket] += count;
        }
      }
    });
  }

  const statusDistribution = (Object.entries(statusBuckets) as Array<
    [keyof typeof statusBuckets, number]
  >)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const rawNodeBandwidth =
    trafficOverview?.trafficSummary?.bandwidthByNode ??
    trafficOverview?.bandwidthByNode ??
    [];

  const bandwidthByNode = rawNodeBandwidth
    .map((entry) => {
      const rx = Number(entry.rx ?? entry.rxBytes ?? 0) || 0;
      const tx = Number(entry.tx ?? entry.txBytes ?? 0) || 0;
      return {
        name: entry.nodeName ?? entry.name ?? entry.nodeId ?? "Unknown",
        rx,
        tx,
      };
    })
    .sort((a, b) => b.rx + b.tx - (a.rx + a.tx));

  const totalRequests =
    trafficOverview?.trafficSummary?.totalRequests ??
    trafficOverview?.totalRequests ??
    requestDistribution.reduce((sum, item) => sum + item.requests, 0);

  const totalBandwidth =
    trafficOverview?.trafficSummary?.totalBandwidth ??
    trafficOverview?.totalBandwidth ??
    bandwidthByNode.reduce((sum, node) => sum + node.rx + node.tx, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Overview of all your Zoraxy instances
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Nodes"
            value={totalNodes}
            icon={Server}
          />
          <StatCard
            title="Online"
            value={onlineNodes}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Offline"
            value={offlineNodes}
            icon={XCircle}
            variant="danger"
          />
          <StatCard
            title="Degraded"
            value={degradedNodes}
            icon={AlertTriangle}
            variant="warning"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Requests"
            value={Number(totalRequests || 0).toLocaleString()}
            icon={Activity}
            variant="success"
          />
          <StatCard
            title="Total Bandwidth"
            value={formatBytes(Number(totalBandwidth || 0))}
            icon={Globe}
          />
          <StatCard
            title="Active Proxy Rules"
            value={overview?.totalProxyRules ?? 0}
            icon={Server}
            variant="warning"
          />
          <StatCard
            title="Certificates"
            value={`${overview?.totalCertificates ?? 0} / ${overview?.expiringCerts ?? 0} expiring`}
            icon={Lock}
            variant={(overview?.expiringCerts ?? 0) > 0 ? "warning" : "success"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/nodes/new">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Server className="h-4 w-4" />
                  Add New Node
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
              <Link href="/nodes">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Globe className="h-4 w-4" />
                  Manage Nodes
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Lock className="h-4 w-4" />
                  Config Templates
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
              <Link href="/audit">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Activity className="h-4 w-4" />
                  Audit Log
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Link href="/audit">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {overview?.recentActivity && overview.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {overview.recentActivity.slice(0, 8).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            entry.result === "success" ? "success" : "danger"
                          }
                          className="text-[10px] px-1.5"
                        >
                          {entry.result}
                        </Badge>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {entry.action}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
                  No recent activity
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {nodes && nodes.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Node Health Grid</CardTitle>
              <Link href="/nodes">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {nodes.slice(0, 5).map((node) => (
                  <div
                    key={node.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            node.status === "online"
                              ? "bg-emerald-500"
                              : node.status === "degraded"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium">{node.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {node.host}:{node.port}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          node.status === "online"
                            ? "success"
                            : node.status === "degraded"
                            ? "warning"
                            : "danger"
                        }
                        className="text-[10px]"
                      >
                        {node.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Last seen: {formatLastSeen(node.lastSeen)}</span>
                      {node.location && (
                        <Badge variant="secondary" className="text-[10px]">
                          {node.location}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      <Link href={`/nodes/${node.id}`}>
                        <Button variant="outline" size="sm" className="w-full justify-between">
                          View Node
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Distribution by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-zinc-200 bg-zinc-100/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                {requestDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={requestDistribution} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.3} />
                      <XAxis
                        dataKey="country"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={{ stroke: "#52525b" }}
                        tickLine={{ stroke: "#52525b" }}
                      />
                      <YAxis
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={{ stroke: "#52525b" }}
                        tickLine={{ stroke: "#52525b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#3f3f46",
                          borderRadius: "0.5rem",
                          color: "#f4f4f5",
                        }}
                        cursor={{ fill: "rgba(113, 113, 122, 0.2)" }}
                      />
                      <Bar dataKey="requests" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message="No request origin data available yet" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Code Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-zinc-200 bg-zinc-100/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {statusDistribution.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? "#71717a"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#3f3f46",
                          borderRadius: "0.5rem",
                          color: "#f4f4f5",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message="No status code data available yet" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bandwidth by Node (RX / TX)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-200 bg-zinc-100/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {bandwidthByNode.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={bandwidthByNode} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      axisLine={{ stroke: "#52525b" }}
                      tickLine={{ stroke: "#52525b" }}
                    />
                    <YAxis
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      axisLine={{ stroke: "#52525b" }}
                      tickLine={{ stroke: "#52525b" }}
                    />
                    <Tooltip
                      formatter={(value) => formatBytes(Number(value ?? 0))}
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#3f3f46",
                        borderRadius: "0.5rem",
                        color: "#f4f4f5",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="rx" name="RX" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tx" name="TX" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No bandwidth metrics available yet" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

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
  "2xx": "#059669",
  "3xx": "#2563eb",
  "4xx": "#d97706",
  "5xx": "#dc2626",
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
    <div className="flex h-[280px] items-center justify-center text-sm text-md-on-surface-variant">
      {message}
    </div>
  );
}

const STAT_ICON_STYLES = {
  default: {
    bg: "bg-md-secondary-container",
    icon: "text-md-secondary",
  },
  success: {
    bg: "bg-md-success-container",
    icon: "text-md-success",
  },
  warning: {
    bg: "bg-md-warning-container",
    icon: "text-md-warning",
  },
  danger: {
    bg: "bg-md-error-container",
    icon: "text-md-error",
  },
} as const;

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
  const style = STAT_ICON_STYLES[variant];

  return (
    <Card className="hover:elevation-2 transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-md-on-surface-variant">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-md-on-surface">{value}</p>
          </div>
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${style.bg}`}
          >
            <Icon className={`h-5 w-5 ${style.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--md-surface)",
  borderColor: "var(--md-outline-variant)",
  borderRadius: "0.75rem",
  color: "var(--md-on-surface)",
  boxShadow: "var(--md-elevation-3)",
  border: "1px solid var(--md-outline-variant)",
};

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
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-md-on-surface">Dashboard</h2>
          <p className="mt-1 text-md-on-surface-variant">
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
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Server className="h-4 w-4 text-md-primary" />
                  Add New Node
                  <ArrowRight className="ml-auto h-4 w-4 text-md-on-surface-variant" />
                </Button>
              </Link>
              <Link href="/nodes">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Globe className="h-4 w-4 text-md-primary" />
                  Manage Nodes
                  <ArrowRight className="ml-auto h-4 w-4 text-md-on-surface-variant" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Lock className="h-4 w-4 text-md-primary" />
                  Config Templates
                  <ArrowRight className="ml-auto h-4 w-4 text-md-on-surface-variant" />
                </Button>
              </Link>
              <Link href="/audit">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Activity className="h-4 w-4 text-md-primary" />
                  Audit Log
                  <ArrowRight className="ml-auto h-4 w-4 text-md-on-surface-variant" />
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
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-md-surface-container"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge
                          variant={
                            entry.result === "success" ? "success" : "danger"
                          }
                          className="text-[10px] px-2"
                        >
                          {entry.result}
                        </Badge>
                        <span className="text-md-on-surface">
                          {entry.action}
                        </span>
                      </div>
                      <span className="text-xs text-md-on-surface-variant">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-md-on-surface-variant py-4 text-center">
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
                    className="rounded-xl border border-md-outline-variant bg-md-surface-container-low p-4 transition-all duration-200 hover:elevation-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 ring-offset-md-surface-container-low ${
                            node.status === "online"
                              ? "bg-md-success ring-md-success/30"
                              : node.status === "degraded"
                              ? "bg-md-warning ring-md-warning/30"
                              : "bg-md-error ring-md-error/30"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-md-on-surface">{node.name}</p>
                          <p className="text-xs text-md-on-surface-variant">
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

                    <div className="mt-3 flex items-center justify-between text-xs text-md-on-surface-variant">
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
              <div className="rounded-xl bg-md-surface-container-low p-4">
                {requestDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={requestDistribution} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" opacity={0.5} />
                      <XAxis
                        dataKey="country"
                        tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
                        axisLine={{ stroke: "var(--md-outline-variant)" }}
                        tickLine={{ stroke: "var(--md-outline-variant)" }}
                      />
                      <YAxis
                        tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
                        axisLine={{ stroke: "var(--md-outline-variant)" }}
                        tickLine={{ stroke: "var(--md-outline-variant)" }}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: "var(--md-primary-container)", opacity: 0.3 }}
                      />
                      <Bar dataKey="requests" fill="var(--md-primary)" radius={[8, 8, 0, 0]} />
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
              <div className="rounded-xl bg-md-surface-container-low p-4">
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
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {statusDistribution.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? "#71717a"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
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
            <div className="rounded-xl bg-md-surface-container-low p-4">
              {bandwidthByNode.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={bandwidthByNode} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
                      axisLine={{ stroke: "var(--md-outline-variant)" }}
                      tickLine={{ stroke: "var(--md-outline-variant)" }}
                    />
                    <YAxis
                      tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
                      axisLine={{ stroke: "var(--md-outline-variant)" }}
                      tickLine={{ stroke: "var(--md-outline-variant)" }}
                    />
                    <Tooltip
                      formatter={(value) => formatBytes(Number(value ?? 0))}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                    <Legend />
                    <Bar dataKey="rx" name="RX" fill="var(--md-info)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="tx" name="TX" fill="var(--md-tertiary)" radius={[6, 6, 0, 0]} />
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

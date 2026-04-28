"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  RotateCcw,
  Globe,
  Shield,
  Radio,
  BarChart3,
  ArrowRightLeft,
  Lock,
  Copy,
  Container,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NodeStatusBadge } from "@/components/nodes/node-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { useNode, useNodeHealth, useDeleteNode, useTestNode } from "@/hooks/use-nodes";
import { useDockerRestart } from "@/hooks/use-docker";

const managementLinks = [
  { href: "proxies", label: "Proxy Rules", icon: Globe, description: "Manage reverse proxy rules" },
  { href: "certs", label: "Certificates", icon: Lock, description: "TLS/SSL certificates" },
  { href: "access", label: "Access Control", icon: Shield, description: "Blacklist & whitelist" },
  { href: "streams", label: "Stream Proxy", icon: Radio, description: "TCP/UDP proxy" },
  { href: "redirects", label: "Redirections", icon: ArrowRightLeft, description: "URL redirections" },
  { href: "sync", label: "Config Sync", icon: Copy, description: "Export, import, compare, clone" },
  { href: "stats", label: "Statistics", icon: BarChart3, description: "Traffic & analytics" },
  { href: "docker", label: "Docker", icon: Container, description: "Manage Docker container" },
  { href: "files", label: "Files", icon: Folder, description: "Browse and edit config files" },
];

export default function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: node, isLoading } = useNode(id);
  const { data: health } = useNodeHealth(id);
  const deleteNode = useDeleteNode();
  const testNode = useTestNode();
  const restartDocker = useDockerRestart(id);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this node?")) return;
    await deleteNode.mutateAsync(id);
    router.push("/nodes");
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </AppShell>
    );
  }

  if (!node) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p className="text-zinc-500">Node not found</p>
          <Link href="/nodes" className="mt-4 inline-block">
            <Button variant="outline">Back to Nodes</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/nodes">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight truncate">
                  {node.name}
                </h2>
                <NodeStatusBadge status={node.status} />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 truncate">
                {node.protocol}://{node.host}:{node.port}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testNode.mutate(id)}
              disabled={testNode.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${testNode.isPending ? "animate-spin" : ""}`}
              />
              Test
            </Button>
            {node.connectionMode !== "direct" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => restartDocker.mutate()}
                disabled={restartDocker.isPending}
              >
                <RotateCcw
                  className={`h-4 w-4 ${restartDocker.isPending ? "animate-spin" : ""}`}
                />
                Restart Docker
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteNode.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Zoraxy Version
              </p>
              <p className="mt-1 text-lg font-semibold">
                {health?.zoraxyVersion || node.zoraxyVersion || "Unknown"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Proxy Rules
              </p>
              <p className="mt-1 text-lg font-semibold">
                {health?.proxyCount ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Certificates
              </p>
              <p className="mt-1 text-lg font-semibold">
                {health?.certCount ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Connection
              </p>
              <p className="mt-1 text-lg font-semibold capitalize">
                {node.connectionMode}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Node Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Host
                </dt>
                <dd className="font-mono text-sm">{node.host}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Port
                </dt>
                <dd className="font-mono text-sm">{node.port}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Auth Method
                </dt>
                <dd className="text-sm capitalize">{node.authMethod}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Location
                </dt>
                <dd className="text-sm">{node.location || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Last Seen
                </dt>
                <dd className="text-sm">
                  {node.lastSeen
                    ? new Date(node.lastSeen).toLocaleString()
                    : "Never"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tags
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {node.tags.length > 0
                    ? node.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))
                    : "None"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-4 text-lg font-semibold">Management</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {managementLinks.map((link) => (
              <Link key={link.href} href={`/nodes/${id}/${link.href}`}>
                <Card className="transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <link.icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium">{link.label}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {link.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

"use client";

import { use, useState, useEffect } from "react";
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
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NodeStatusBadge } from "@/components/nodes/node-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { useNode, useNodeHealth, useDeleteNode, useTestNode, useUpdateNode } from "@/hooks/use-nodes";
import { useDockerRestart } from "@/hooks/use-docker";
import type { Node } from "@/types/node";

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

function EditNodeDialog({
  node,
  open,
  onOpenChange,
}: {
  node: Node;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateNode = useUpdateNode();
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "",
    protocol: "https",
    connectionMode: "direct",
    authMethod: "session",
    username: "",
    password: "",
    agentToken: "",
    agentPort: "9191",
    agentTls: false,
    location: "",
    tags: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && node) {
      setForm({
        name: node.name,
        host: node.host,
        port: String(node.port),
        protocol: node.protocol,
        connectionMode: node.connectionMode,
        authMethod: node.authMethod,
        username: "",
        password: "",
        agentToken: node.agentToken || "",
        agentPort: String(node.agentPort),
        agentTls: node.agentTls,
        location: node.location || "",
        tags: node.tags.join(", "),
      });
      setError("");
    }
  }, [open, node]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await updateNode.mutateAsync({
        id: node.id,
        name: form.name,
        host: form.host,
        port: parseInt(form.port),
        protocol: form.protocol,
        connectionMode: form.connectionMode,
        authMethod: form.authMethod,
        username: form.username || undefined,
        password: form.password || undefined,
        agentToken: form.agentToken || undefined,
        agentPort: parseInt(form.agentPort, 10),
        agentTls: form.agentTls,
        location: form.location || undefined,
        tags: form.tags
          ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update node");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Node</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Not set"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Protocol</label>
              <Select
                value={form.protocol}
                onValueChange={(v) => updateField("protocol", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Host</label>
              <Input
                value={form.host}
                onChange={(e) => updateField("host", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => updateField("port", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection Mode</label>
              <Select
                value={form.connectionMode}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    connectionMode: v,
                    authMethod: v === "agent" ? "agent_key" : f.authMethod,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct API</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Auth Method</label>
              <Select
                value={form.authMethod}
                onValueChange={(v) => updateField("authMethod", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session">Session (Username/Password)</SelectItem>
                  <SelectItem value="noauth">No Auth</SelectItem>
                  <SelectItem value="agent_key">Agent API Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.connectionMode === "agent" && (
            <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium">Agent Connection</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Port</label>
                  <Input
                    type="number"
                    value={form.agentPort}
                    onChange={(e) => updateField("agentPort", e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.agentTls}
                      onChange={(e) => updateField("agentTls", e.target.checked)}
                      className="rounded"
                    />
                    Agent TLS
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent API Key</label>
                <Input
                  value={form.agentToken}
                  onChange={(e) => updateField("agentToken", e.target.value)}
                  placeholder="Pre-shared agent API key"
                />
              </div>
            </div>
          )}

          {form.authMethod === "session" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
            </div>
          )}

          {form.authMethod === "agent_key" && form.connectionMode !== "agent" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent API Key</label>
              <Input
                value={form.agentToken}
                onChange={(e) => updateField("agentToken", e.target.value)}
                placeholder="Pre-shared agent API key"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <Input
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
              placeholder="production, us-east (comma-separated)"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateNode.isPending}>
              {updateNode.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const [editOpen, setEditOpen] = useState(false);

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
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
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

      <EditNodeDialog
        node={node}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </AppShell>
  );
}

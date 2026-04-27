"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { useCreateNode, useTestConnection } from "@/hooks/use-nodes";

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function AddNodePage() {
  const router = useRouter();
  const createNode = useCreateNode();
  const testConnection = useTestConnection();

  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "8000",
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
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const updateField = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTestResult(null);
  };

  const handleConnectionModeChange = (value: string) => {
    setForm((f) => ({
      ...f,
      connectionMode: value,
      authMethod: value === "agent" ? "agent_key" : f.authMethod,
    }));
    setTestResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const node = await createNode.mutateAsync({
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
      router.push(`/nodes/${node.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create node");
    }
  };

  const handleTest = async () => {
    setError("");
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        connectionMode: form.connectionMode,
        host: form.host,
        port: parseInt(form.port),
        protocol: form.protocol,
        authMethod: form.authMethod,
        username: form.username || undefined,
        password: form.password || undefined,
        agentToken: form.agentToken || undefined,
        agentPort: parseInt(form.agentPort, 10),
        agentTls: form.agentTls,
      });
      setTestResult(result.connected);
      if (!result.connected) {
        setError("Connection failed — Zoraxy instance rejected the connection");
      }
    } catch (err) {
      setTestResult(false);
      setError(err instanceof Error ? err.message : "Connection test failed");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/nodes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Add Node</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Register a new Zoraxy instance
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Connection Details</CardTitle>
              <CardDescription>
                Configure how ZoraxyHub connects to this Zoraxy instance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              {testResult !== null && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    testResult
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                  }`}
                >
                  {testResult
                    ? "Connection successful!"
                    : "Connection failed. Check your settings."}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="US East Production"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="us-east-1"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <label className="text-sm font-medium">
                    {form.connectionMode === "agent" ? "Zoraxy Protocol" : "Protocol"}
                  </label>
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
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {form.connectionMode === "agent" ? "Zoraxy Port" : "Port"}
                  </label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) => updateField("port", e.target.value)}
                    placeholder="8000"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Connection Mode</label>
                  <Select
                    value={form.connectionMode}
                    onValueChange={handleConnectionModeChange}
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
                      <SelectItem value="noauth">No Auth (-noauth mode)</SelectItem>
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
                        placeholder="9191"
                        required
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
                    <div className="flex gap-2">
                      <Input
                        value={form.agentToken}
                        onChange={(e) => updateField("agentToken", e.target.value)}
                        placeholder="Pre-shared agent API key"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => updateField("agentToken", generateApiKey())}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {form.authMethod === "session" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Zoraxy Username
                    </label>
                    <Input
                      value={form.username}
                      onChange={(e) => updateField("username", e.target.value)}
                      placeholder="admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Zoraxy Password
                    </label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder="Enter password"
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
                  placeholder="production, us-east, web (comma-separated)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={createNode.isPending}>
                  {createNode.isPending ? "Creating..." : "Create Node"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testConnection.isPending || !form.host}
                >
                  {testConnection.isPending ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppShell>
  );
}

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, GitCompare, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useNode, useNodes } from "@/hooks/use-nodes";

interface NodeConfig {
  proxyRules: Array<{ RootOrMatchingDomain: string }>;
  certs: Array<{ Domain: string }>;
  accessRules: unknown[];
  streamProxies: unknown[];
  redirects: unknown[];
  systemInfo: Record<string, unknown>;
  exportedAt: string;
  nodeId: string;
  nodeName: string;
}

interface ConfigDiff {
  proxyRules: {
    added: Array<{ RootOrMatchingDomain: string }>;
    removed: Array<{ RootOrMatchingDomain: string }>;
    modified: Array<{ domain: string }>;
    unchanged: string[];
  };
  certs: {
    added: Array<{ Domain: string }>;
    removed: Array<{ Domain: string }>;
    unchanged: string[];
  };
  streamProxies: { added: unknown[]; removed: unknown[] };
  redirects: { added: unknown[]; removed: unknown[] };
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface CloneResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function NodeConfigSyncPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const api = useApi();
  const { data: node } = useNode(id);
  const { data: allNodes } = useNodes();

  const selectableNodes = useMemo(
    () => (allNodes ?? []).filter((item) => item.id !== id),
    [allNodes, id]
  );

  const [importConfig, setImportConfig] = useState<NodeConfig | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importSkipExisting, setImportSkipExisting] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importParseError, setImportParseError] = useState("");

  const [compareTargetNodeId, setCompareTargetNodeId] = useState("");
  const [compareResult, setCompareResult] = useState<ConfigDiff | null>(null);

  const [cloneSourceNodeId, setCloneSourceNodeId] = useState("");
  const [cloneOptions, setCloneOptions] = useState({
    proxyRules: true,
    certs: true,
    streams: true,
    redirects: true,
  });
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null);

  const [busy, setBusy] = useState<"" | "export" | "import" | "compare" | "clone">("");

  const handleExport = async () => {
    setBusy("export");
    try {
      const config = await api.get<NodeConfig>(`/api/v1/nodes/${id}/config/export`);
      const timestamp = new Date(config.exportedAt).toISOString().replace(/[:.]/g, "-");
      const fileName = `${config.nodeName || id}-config-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy("");
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImportParseError("");
    setImportResult(null);

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as NodeConfig;
      setImportConfig(parsed);
      setImportFileName(file.name);
    } catch {
      setImportConfig(null);
      setImportFileName("");
      setImportParseError("Invalid JSON file. Please upload a valid exported config.");
    }
  };

  const handleImport = async () => {
    if (!importConfig) return;
    setBusy("import");
    try {
      const result = await api.post<ImportResult>(`/api/v1/nodes/${id}/config/import`, {
        config: importConfig,
        overwrite: importOverwrite,
        skipExisting: importSkipExisting,
      });
      setImportResult(result);
    } finally {
      setBusy("");
    }
  };

  const handleCompare = async () => {
    if (!compareTargetNodeId) return;
    setBusy("compare");
    try {
      const result = await api.post<ConfigDiff>("/api/v1/nodes/compare", {
        sourceNodeId: id,
        targetNodeId: compareTargetNodeId,
      });
      setCompareResult(result);
    } finally {
      setBusy("");
    }
  };

  const handleClone = async () => {
    if (!cloneSourceNodeId) return;
    setBusy("clone");
    try {
      const result = await api.post<CloneResult>(`/api/v1/nodes/${id}/config/clone`, {
        sourceNodeId: cloneSourceNodeId,
        proxyRules: cloneOptions.proxyRules,
        certs: cloneOptions.certs,
        streams: cloneOptions.streams,
        redirects: cloneOptions.redirects,
      });
      setCloneResult(result);
    } finally {
      setBusy("");
    }
  };

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
            <h2 className="text-2xl font-bold tracking-tight">Config Sync</h2>
            <p className="text-zinc-500 dark:text-zinc-400">{node?.name ?? "Loading..."}</p>
          </div>
        </div>

        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="clone">Clone</TabsTrigger>
          </TabsList>

          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Export Node Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Export this node&apos;s full config as JSON (proxy rules, certs, access,
                  streams, redirects, and system info).
                </p>
                <Button onClick={() => void handleExport()} disabled={busy === "export"}>
                  <Download className="h-4 w-4" />
                  {busy === "export" ? "Exporting..." : "Download JSON"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">JSON Config File</label>
                  <Input
                    className="mt-1"
                    type="file"
                    accept="application/json"
                    onChange={(event) =>
                      void handleImportFile(event.target.files?.[0] ?? null)
                    }
                  />
                </div>

                {importFileName ? (
                  <Badge variant="outline">Loaded: {importFileName}</Badge>
                ) : null}
                {importParseError ? <p className="text-sm text-red-500">{importParseError}</p> : null}

                {importConfig ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Badge variant="secondary">Proxy: {importConfig.proxyRules.length}</Badge>
                    <Badge variant="secondary">Certs: {importConfig.certs.length}</Badge>
                    <Badge variant="secondary">Access: {importConfig.accessRules.length}</Badge>
                    <Badge variant="secondary">Streams: {importConfig.streamProxies.length}</Badge>
                    <Badge variant="secondary">Redirects: {importConfig.redirects.length}</Badge>
                    <Badge variant="secondary">From: {importConfig.nodeName}</Badge>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={importOverwrite}
                      onChange={(event) => setImportOverwrite(event.target.checked)}
                      className="rounded"
                    />
                    Overwrite existing items
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={importSkipExisting}
                      onChange={(event) => setImportSkipExisting(event.target.checked)}
                      className="rounded"
                    />
                    Skip existing items
                  </label>
                </div>

                <Button
                  onClick={() => void handleImport()}
                  disabled={!importConfig || busy === "import"}
                >
                  <Upload className="h-4 w-4" />
                  {busy === "import" ? "Importing..." : "Run Import"}
                </Button>

                {importResult ? (
                  <div className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <p>Success: {importResult.success}</p>
                    <p>Failed: {importResult.failed}</p>
                    <p>Skipped: {importResult.skipped}</p>
                    {importResult.errors.length > 0 ? (
                      <div className="space-y-1 text-red-500">
                        {importResult.errors.map((error, index) => (
                          <p key={`${error}-${index}`}>{error}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare">
            <Card>
              <CardHeader>
                <CardTitle>Compare Nodes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Compare against node</label>
                  <Select value={compareTargetNodeId} onValueChange={setCompareTargetNodeId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select target node" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableNodes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => void handleCompare()}
                  disabled={!compareTargetNodeId || busy === "compare"}
                >
                  <GitCompare className="h-4 w-4" />
                  {busy === "compare" ? "Comparing..." : "Compare"}
                </Button>

                {compareResult ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <p className="font-medium">Proxy Rules</p>
                      <p className="text-sm text-emerald-600">Added: {compareResult.proxyRules.added.length}</p>
                      <p className="text-sm text-red-600">Removed: {compareResult.proxyRules.removed.length}</p>
                      <p className="text-sm text-amber-600">Modified: {compareResult.proxyRules.modified.length}</p>
                      <p className="text-sm text-zinc-500">Unchanged: {compareResult.proxyRules.unchanged.length}</p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                          <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Added</p>
                          {compareResult.proxyRules.added.length > 0 ? (
                            compareResult.proxyRules.added.map((item) => (
                              <p key={item.RootOrMatchingDomain} className="font-mono text-xs text-emerald-700 dark:text-emerald-300">
                                {item.RootOrMatchingDomain}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">None</p>
                          )}
                        </div>

                        <div className="rounded border border-red-200 bg-red-50 p-2 dark:border-red-900/50 dark:bg-red-950/20">
                          <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-300">Removed</p>
                          {compareResult.proxyRules.removed.length > 0 ? (
                            compareResult.proxyRules.removed.map((item) => (
                              <p key={item.RootOrMatchingDomain} className="font-mono text-xs text-red-700 dark:text-red-300">
                                {item.RootOrMatchingDomain}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">None</p>
                          )}
                        </div>

                        <div className="rounded border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                          <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Modified</p>
                          {compareResult.proxyRules.modified.length > 0 ? (
                            compareResult.proxyRules.modified.map((item) => (
                              <p key={item.domain} className="font-mono text-xs text-amber-700 dark:text-amber-300">
                                {item.domain}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">None</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <p className="font-medium">Certificates</p>
                      <p className="text-sm text-emerald-600">Added: {compareResult.certs.added.length}</p>
                      <p className="text-sm text-red-600">Removed: {compareResult.certs.removed.length}</p>
                      <p className="text-sm text-zinc-500">Unchanged: {compareResult.certs.unchanged.length}</p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                          <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Added</p>
                          {compareResult.certs.added.length > 0 ? (
                            compareResult.certs.added.map((item) => (
                              <p key={item.Domain} className="font-mono text-xs text-emerald-700 dark:text-emerald-300">
                                {item.Domain}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">None</p>
                          )}
                        </div>

                        <div className="rounded border border-red-200 bg-red-50 p-2 dark:border-red-900/50 dark:bg-red-950/20">
                          <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-300">Removed</p>
                          {compareResult.certs.removed.length > 0 ? (
                            compareResult.certs.removed.map((item) => (
                              <p key={item.Domain} className="font-mono text-xs text-red-700 dark:text-red-300">
                                {item.Domain}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">None</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <p className="font-medium">Streams</p>
                      <p className="text-sm text-emerald-600">Added: {compareResult.streamProxies.added.length}</p>
                      <p className="text-sm text-red-600">Removed: {compareResult.streamProxies.removed.length}</p>
                    </div>

                    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <p className="font-medium">Redirects</p>
                      <p className="text-sm text-emerald-600">Added: {compareResult.redirects.added.length}</p>
                      <p className="text-sm text-red-600">Removed: {compareResult.redirects.removed.length}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clone">
            <Card>
              <CardHeader>
                <CardTitle>Clone Config from Another Node</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Source node</label>
                  <Select value={cloneSourceNodeId} onValueChange={setCloneSourceNodeId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select source node" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableNodes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cloneOptions.proxyRules}
                      onChange={(event) =>
                        setCloneOptions((prev) => ({
                          ...prev,
                          proxyRules: event.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    Proxy rules
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cloneOptions.certs}
                      onChange={(event) =>
                        setCloneOptions((prev) => ({ ...prev, certs: event.target.checked }))
                      }
                      className="rounded"
                    />
                    Certificates
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cloneOptions.streams}
                      onChange={(event) =>
                        setCloneOptions((prev) => ({ ...prev, streams: event.target.checked }))
                      }
                      className="rounded"
                    />
                    Streams
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cloneOptions.redirects}
                      onChange={(event) =>
                        setCloneOptions((prev) => ({
                          ...prev,
                          redirects: event.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    Redirects
                  </label>
                </div>

                <Button
                  onClick={() => void handleClone()}
                  disabled={!cloneSourceNodeId || busy === "clone"}
                >
                  <Copy className="h-4 w-4" />
                  {busy === "clone" ? "Cloning..." : "Run Clone"}
                </Button>

                {cloneResult ? (
                  <div className="space-y-1 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <p>Success: {cloneResult.success}</p>
                    <p>Failed: {cloneResult.failed}</p>
                    {cloneResult.errors.length > 0 ? (
                      <div className="space-y-1 text-red-500">
                        {cloneResult.errors.map((error, index) => (
                          <p key={`${error}-${index}`}>{error}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

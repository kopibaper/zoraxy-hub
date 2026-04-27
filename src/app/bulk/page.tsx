"use client";

import { useState } from "react";
import { Rocket, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/app-shell";
import { useNodes } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";
import type { BulkOperationResult } from "@/types/api";

type BulkAction = "add_proxy" | "delete_proxy" | "obtain_cert";

const actionLabels: Record<BulkAction, string> = {
  add_proxy: "Add Proxy Rule",
  delete_proxy: "Delete Proxy Rule",
  obtain_cert: "Obtain ACME Certificate",
};

export default function BulkPage() {
  const { data: nodes } = useNodes();
  const api = useApi();

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [action, setAction] = useState<BulkAction>("add_proxy");
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<BulkOperationResult[] | null>(null);

  const [proxyForm, setProxyForm] = useState({
    rootOrMatchingDomain: "",
    originIp: "",
    requireTLS: false,
  });
  const [certForm, setCertForm] = useState({ domains: "", email: "" });
  const [deleteForm, setDeleteForm] = useState({ domain: "" });

  const toggleNode = (nodeId: string) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const selectAll = () => {
    if (nodes) setSelectedNodes(nodes.map((n) => n.id));
  };

  const handleExecute = async () => {
    if (selectedNodes.length === 0) return;

    setExecuting(true);
    setResults(null);

    try {
      let endpoint = "";
      let body: Record<string, unknown> = { nodeIds: selectedNodes };

      switch (action) {
        case "add_proxy":
          endpoint = "/api/v1/bulk/proxy/add";
          body = {
            ...body,
            proxyType: "subd",
            rootOrMatchingDomain: proxyForm.rootOrMatchingDomain,
            origins: [
              {
                ip: proxyForm.originIp,
                requireTLS: proxyForm.requireTLS,
              },
            ],
          };
          break;
        case "delete_proxy":
          endpoint = "/api/v1/bulk/proxy/delete";
          body = { ...body, domain: deleteForm.domain };
          break;
        case "obtain_cert":
          endpoint = "/api/v1/bulk/cert/obtain";
          body = {
            ...body,
            domains: certForm.domains.split(",").map((d) => d.trim()),
            email: certForm.email,
          };
          break;
      }

      const data = await api.post<BulkOperationResult[]>(endpoint, body);
      setResults(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk operation failed");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Bulk Operations
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Execute operations across multiple nodes at once
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Select Nodes ({selectedNodes.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
            </CardHeader>
            <CardContent>
              {nodes && nodes.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {nodes.map((node) => (
                    <label
                      key={node.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        selectedNodes.includes(node.id)
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNodes.includes(node.id)}
                        onChange={() => toggleNode(node.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {node.name}
                          </span>
                          <div
                            className={`h-2 w-2 rounded-full ${
                              node.status === "online"
                                ? "bg-emerald-500"
                                : node.status === "degraded"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          />
                        </div>
                        <span className="text-xs text-zinc-500">
                          {node.host}:{node.port}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 py-4 text-center">
                  No nodes available
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <select
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={action}
                  onChange={(e) => setAction(e.target.value as BulkAction)}
                >
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>

                {action === "add_proxy" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Domain</label>
                      <Input
                        className="mt-1"
                        placeholder="app.example.com"
                        value={proxyForm.rootOrMatchingDomain}
                        onChange={(e) =>
                          setProxyForm({
                            ...proxyForm,
                            rootOrMatchingDomain: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Origin</label>
                      <Input
                        className="mt-1"
                        placeholder="localhost:3000"
                        value={proxyForm.originIp}
                        onChange={(e) =>
                          setProxyForm({
                            ...proxyForm,
                            originIp: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="bulkTLS"
                        checked={proxyForm.requireTLS}
                        onChange={(e) =>
                          setProxyForm({
                            ...proxyForm,
                            requireTLS: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <label htmlFor="bulkTLS" className="text-sm">
                        Require TLS
                      </label>
                    </div>
                  </div>
                )}

                {action === "delete_proxy" && (
                  <div>
                    <label className="text-sm font-medium">Domain to Delete</label>
                    <Input
                      className="mt-1"
                      placeholder="app.example.com"
                      value={deleteForm.domain}
                      onChange={(e) =>
                        setDeleteForm({ domain: e.target.value })
                      }
                    />
                  </div>
                )}

                {action === "obtain_cert" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">
                        Domains (comma-separated)
                      </label>
                      <Input
                        className="mt-1"
                        placeholder="example.com, www.example.com"
                        value={certForm.domains}
                        onChange={(e) =>
                          setCertForm({ ...certForm, domains: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        className="mt-1"
                        type="email"
                        placeholder="admin@example.com"
                        value={certForm.email}
                        onChange={(e) =>
                          setCertForm({ ...certForm, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleExecute}
                  disabled={selectedNodes.length === 0 || executing}
                >
                  {executing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Execute on {selectedNodes.length} Node
                  {selectedNodes.length !== 1 ? "s" : ""}
                </Button>
              </CardContent>
            </Card>

            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div
                        key={result.nodeId}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {result.nodeName}
                          </span>
                        </div>
                        <div>
                          {result.success ? (
                            <Badge variant="success" className="text-[10px]">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="danger" className="text-[10px]">
                              {result.error || "Failed"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

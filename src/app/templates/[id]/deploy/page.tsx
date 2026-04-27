"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Rocket, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/app-shell";
import { useTemplate, useDeployTemplate, useTemplateDeployments } from "@/hooks/use-templates";
import { useNodes } from "@/hooks/use-nodes";

type LiveNodeStatus = "deploying" | "deployed" | "failed";

interface ExecutionResult {
  nodeId: string;
  success: boolean;
  status: "pending" | "deploying" | "deployed" | "failed" | "outdated";
  error: string | null;
  deployedAt: string | null;
  deploymentId: string;
}

const variablePattern = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

function extractVariableNames(config: unknown): string[] {
  const found = new Set<string>();

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(variablePattern)) {
        if (match[1]) {
          found.add(match[1]);
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        visit(nested);
      }
    }
  };

  visit(config);
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

export default function DeployTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: template } = useTemplate(id);
  const { data: nodes } = useNodes();
  const { data: deployments } = useTemplateDeployments(id);
  const deploy = useDeployTemplate(id);

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveNodeStatus>>({});
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);

  const requiredVariables = useMemo(() => {
    if (!template || !template.config) {
      return [];
    }

    return extractVariableNames(template.config);
  }, [template]);

  const missingVariables = useMemo(() => {
    return requiredVariables.filter((name) => {
      const value = variableValues[name];
      return !value || value.trim().length === 0;
    });
  }, [requiredVariables, variableValues]);

  const toggleNode = (nodeId: string) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const selectAll = () => {
    if (nodes) {
      setSelectedNodes(nodes.map((n) => n.id));
    }
  };

  const handleDeploy = async () => {
    if (selectedNodes.length === 0) return;

    if (missingVariables.length > 0) {
      alert(`Please fill required variables: ${missingVariables.join(", ")}`);
      return;
    }

    if (
      !confirm(
        `Deploy template "${template?.name}" to ${selectedNodes.length} node(s)?`
      )
    )
      return;

    const nextStatuses: Record<string, LiveNodeStatus> = {};
    for (const nodeId of selectedNodes) {
      nextStatuses[nodeId] = "deploying";
    }
    setLiveStatuses(nextStatuses);

    const variables: Record<string, string> = {};
    for (const name of requiredVariables) {
      variables[name] = variableValues[name] ?? "";
    }

    try {
      const result = await deploy.mutateAsync({ nodeIds: selectedNodes, variables });
      const mapped = result?.results ?? [];
      setExecutionResults(mapped);

      const finalStatuses: Record<string, LiveNodeStatus> = {};
      for (const item of mapped) {
        finalStatuses[item.nodeId] = item.success ? "deployed" : "failed";
      }
      setLiveStatuses(finalStatuses);
    } catch {
      const failedStatuses: Record<string, LiveNodeStatus> = {};
      for (const nodeId of selectedNodes) {
        failedStatuses[nodeId] = "failed";
      }
      setLiveStatuses(failedStatuses);
    }

    setSelectedNodes([]);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/templates/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Deploy Template
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                {template?.name ?? "Loading..."}
              </p>
            </div>
          </div>
          <Button
            onClick={handleDeploy}
            disabled={
              selectedNodes.length === 0 ||
              deploy.isPending ||
              missingVariables.length > 0
            }
          >
            {deploy.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Deploy to {selectedNodes.length} Node
            {selectedNodes.length !== 1 ? "s" : ""}
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Select Target Nodes</CardTitle>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
          </CardHeader>
          <CardContent>
            {nodes && nodes.length > 0 ? (
              <div className="space-y-2">
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
                        <span className="font-medium text-sm">{node.name}</span>
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
                        {node.location ? ` · ${node.location}` : ""}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-4 text-center">
                No nodes available. Add nodes first.
              </p>
            )}
          </CardContent>
        </Card>

        {requiredVariables.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requiredVariables.map((name) => (
                  <div key={name}>
                    <label className="text-sm font-medium" htmlFor={`var-${name}`}>
                      {name}
                    </label>
                    <Input
                      id={`var-${name}`}
                      className="mt-1"
                      placeholder={`Value for ${name}`}
                      value={variableValues[name] ?? ""}
                      onChange={(event) =>
                        setVariableValues((prev) => ({
                          ...prev,
                          [name]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              {missingVariables.length > 0 && (
                <p className="mt-3 text-xs text-red-500">
                  Missing required variables: {missingVariables.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {Object.keys(liveStatuses).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deployment Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(liveStatuses).map(([nodeId, status]) => (
                  <div
                    key={`live-${nodeId}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      {status === "deployed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      <span className="text-sm">{nodeId}</span>
                    </div>
                    <Badge
                      variant={
                        status === "deployed"
                          ? "success"
                          : status === "failed"
                          ? "danger"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {executionResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Deployment Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {executionResults.map((result) => (
                  <div
                    key={result.deploymentId}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{result.nodeId}</span>
                      <Badge
                        variant={result.success ? "success" : "danger"}
                        className="text-[10px]"
                      >
                        {result.success ? "success" : "failed"}
                      </Badge>
                    </div>
                    {result.error && (
                      <p className="mt-1 text-xs text-red-500">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {deployments && deployments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deployment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deployments.map((dep) => (
                  <div key={dep.id}>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        {dep.status === "deployed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : dep.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        <span className="text-sm">{dep.nodeId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            dep.status === "deployed"
                              ? "success"
                              : dep.status === "failed"
                              ? "danger"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {dep.status}
                        </Badge>
                        {dep.deployedAt && (
                          <span className="text-xs text-zinc-500">
                            {new Date(dep.deployedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {dep.error && (
                      <p className="mt-1 text-xs text-red-500">{dep.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

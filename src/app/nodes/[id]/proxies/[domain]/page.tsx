"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Code,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Server,
  Trash2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/layout/app-shell";
import {
  useAddUpstream,
  useEditProxyRuleForDomain,
  useProxyDetail,
  useRemoveUpstream,
  useUpstreams,
} from "@/hooks/use-proxies";
import { useNode } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";
import type {
  ZoraxyHeaderRewriteRule,
  ZoraxyOrigin,
  ZoraxyVirtualDirectory,
} from "@/lib/zoraxy/types";

function normalizeOrigins(proxyOrigins: ZoraxyOrigin[] | undefined): ZoraxyOrigin[] {
  if (!proxyOrigins) return [];
  return proxyOrigins.map((origin) => ({
    ...origin,
    Disabled: !!origin.Disabled,
  }));
}

export default function ProxyDetailPage({
  params,
}: {
  params: Promise<{ id: string; domain: string }>;
}) {
  const { id, domain } = use(params);
  const decodedDomain = decodeURIComponent(domain);
  const { data: node } = useNode(id);
  const { data: proxy, isLoading } = useProxyDetail(id, decodedDomain);
  const { data: upstreams } = useUpstreams(id, decodedDomain);
  const addUpstream = useAddUpstream(id, decodedDomain);
  const removeUpstream = useRemoveUpstream(id, decodedDomain);
  const editProxy = useEditProxyRuleForDomain(id, decodedDomain);
  const api = useApi();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState({
    useStickySession: false,
    useActiveLoadBalance: false,
    bypassGlobalTLS: false,
    disabled: false,
  });
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasMessage, setAliasMessage] = useState<string | null>(null);

  const [showAddUpstreamDialog, setShowAddUpstreamDialog] = useState(false);
  const [showEditUpstreamDialog, setShowEditUpstreamDialog] = useState(false);
  const [upstreamForm, setUpstreamForm] = useState({
    origin: "",
    requireTLS: false,
    skipCertValidation: false,
    weight: 1,
    disabled: false,
  });
  const [editingUpstreamOrigin, setEditingUpstreamOrigin] = useState<string | null>(null);

  const [showAddVdirDialog, setShowAddVdirDialog] = useState(false);
  const [vdirForm, setVdirForm] = useState({
    matchingPath: "",
    domain: "",
    requireTLS: false,
    skipCertValidation: false,
  });

  const [showAddHeaderDialog, setShowAddHeaderDialog] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    direction: "upstream",
    key: "",
    value: "",
    isRemove: false,
  });

  const [rawJson, setRawJson] = useState("");
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [rawJsonSaved, setRawJsonSaved] = useState(false);
  const [rawJsonDirty, setRawJsonDirty] = useState(false);

  useMemo(() => {
    if (!proxy) return;
    setSettings({
      useStickySession: proxy.UseStickySession,
      useActiveLoadBalance: proxy.UseActiveLoadBalance,
      bypassGlobalTLS: proxy.BypassGlobalTLS,
      disabled: proxy.Disabled,
    });
    setAliases(proxy.MatchingDomainAlias ?? []);
    setRawJson(JSON.stringify(proxy, null, 2));
    setRawJsonDirty(false);
    setRawJsonError(null);
  }, [proxy]);

  const allOrigins = useMemo(() => {
    if (!proxy) return [] as ZoraxyOrigin[];
    const active = normalizeOrigins(proxy.ActiveOrigins).map((origin) => ({
      ...origin,
      Disabled: false,
    }));
    const inactive = normalizeOrigins(proxy.InactiveOrigins).map((origin) => ({
      ...origin,
      Disabled: true,
    }));
    return [...active, ...inactive];
  }, [proxy]);

  const upstreamRows = useMemo(() => {
    if (upstreams && upstreams.length > 0) {
      return upstreams;
    }
    return allOrigins;
  }, [upstreams, allOrigins]);

  const refreshProxyData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["nodes", id, "proxies", decodedDomain] });
    await queryClient.invalidateQueries({
      queryKey: ["nodes", id, "proxies", decodedDomain, "upstreams"],
    });
  }, [queryClient, id, decodedDomain]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJson(value);
    setRawJsonDirty(true);
    setRawJsonSaved(false);
    try {
      JSON.parse(value);
      setRawJsonError(null);
    } catch (e) {
      setRawJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, []);

  const handleRawJsonSave = useCallback(async () => {
    if (rawJsonError) return;
    try {
      const parsed = JSON.parse(rawJson);
      await editProxy.mutateAsync(parsed);
      await refreshProxyData();
      setRawJsonDirty(false);
      setRawJsonSaved(true);
      setTimeout(() => setRawJsonSaved(false), 3000);
    } catch (e) {
      setRawJsonError(e instanceof Error ? e.message : "Failed to save");
    }
  }, [rawJson, rawJsonError, editProxy, refreshProxyData]);

  const handleRawJsonReset = useCallback(() => {
    if (!proxy) return;
    setRawJson(JSON.stringify(proxy, null, 2));
    setRawJsonDirty(false);
    setRawJsonError(null);
    setRawJsonSaved(false);
  }, [proxy]);

  const addVdirMutation = useMutation({
    mutationFn: (input: typeof vdirForm) =>
      api.post(`/api/v1/nodes/${id}/proxies/${encodeURIComponent(decodedDomain)}/vdirs`, input),
    onSuccess: refreshProxyData,
  });

  const removeVdirMutation = useMutation({
    mutationFn: (input: { matchingPath: string }) =>
      api.del(`/api/v1/nodes/${id}/proxies/${encodeURIComponent(decodedDomain)}/vdirs`, input),
    onSuccess: refreshProxyData,
  });

  const addHeaderMutation = useMutation({
    mutationFn: (input: typeof headerForm) =>
      api.post(`/api/v1/nodes/${id}/proxies/${encodeURIComponent(decodedDomain)}/headers`, input),
    onSuccess: refreshProxyData,
  });

  const removeHeaderMutation = useMutation({
    mutationFn: (input: { direction: string; key: string }) =>
      api.del(`/api/v1/nodes/${id}/proxies/${encodeURIComponent(decodedDomain)}/headers`, input),
    onSuccess: refreshProxyData,
  });

  const updateOriginLists = async (
    updater: (origin: ZoraxyOrigin) => ZoraxyOrigin,
    targetOrigin: string
  ) => {
    const updated = allOrigins.map((origin) =>
      origin.OriginIpOrDomain === targetOrigin ? updater(origin) : origin
    );

    const activeOrigins = updated.filter((origin) => !origin.Disabled);
    const inactiveOrigins = updated.filter((origin) => origin.Disabled);

    await editProxy.mutateAsync({
      activeOrigins,
      inactiveOrigins,
    });
    await refreshProxyData();
  };

  const handleSaveSettings = async () => {
    await editProxy.mutateAsync(settings);
    setSettingsMessage("Settings saved.");
    setTimeout(() => setSettingsMessage(null), 2000);
  };

  const handleAddAlias = async () => {
    const newAlias = aliasInput.trim();
    if (!newAlias) return;
    if (aliases.includes(newAlias)) {
      setAliasMessage("Alias already exists.");
      return;
    }
    const nextAliases = [...aliases, newAlias];
    await editProxy.mutateAsync({ matchingDomainAlias: nextAliases });
    setAliases(nextAliases);
    setAliasInput("");
    setAliasMessage("Alias list updated.");
    setTimeout(() => setAliasMessage(null), 2000);
  };

  const handleRemoveAlias = async (alias: string) => {
    const nextAliases = aliases.filter((item) => item !== alias);
    await editProxy.mutateAsync({ matchingDomainAlias: nextAliases });
    setAliases(nextAliases);
    setAliasMessage("Alias removed.");
    setTimeout(() => setAliasMessage(null), 2000);
  };

  const handleAddUpstream = async () => {
    await addUpstream.mutateAsync({
      origin: upstreamForm.origin,
      requireTLS: upstreamForm.requireTLS,
      skipCertValidation: upstreamForm.skipCertValidation,
      weight: upstreamForm.weight,
    });
    setShowAddUpstreamDialog(false);
    setUpstreamForm({
      origin: "",
      requireTLS: false,
      skipCertValidation: false,
      weight: 1,
      disabled: false,
    });
  };

  const handleEditUpstream = (origin: ZoraxyOrigin) => {
    setEditingUpstreamOrigin(origin.OriginIpOrDomain);
    setUpstreamForm({
      origin: origin.OriginIpOrDomain,
      requireTLS: origin.RequireTLS,
      skipCertValidation: origin.SkipCertValidations,
      weight: origin.Weight,
      disabled: !!origin.Disabled,
    });
    setShowEditUpstreamDialog(true);
  };

  const handleSaveUpstreamEdit = async () => {
    if (!editingUpstreamOrigin) return;

    const updated = allOrigins.map((origin) => {
      if (origin.OriginIpOrDomain !== editingUpstreamOrigin) {
        return origin;
      }

      return {
        ...origin,
        OriginIpOrDomain: upstreamForm.origin,
        RequireTLS: upstreamForm.requireTLS,
        SkipCertValidations: upstreamForm.skipCertValidation,
        Weight: upstreamForm.weight,
        Disabled: upstreamForm.disabled,
      };
    });

    const activeOrigins = updated.filter((origin) => !origin.Disabled);
    const inactiveOrigins = updated.filter((origin) => origin.Disabled);

    await editProxy.mutateAsync({ activeOrigins, inactiveOrigins });
    setShowEditUpstreamDialog(false);
    setEditingUpstreamOrigin(null);
    await refreshProxyData();
  };

  const handleToggleUpstream = async (origin: ZoraxyOrigin) => {
    await updateOriginLists(
      (target) => ({
        ...target,
        Disabled: !origin.Disabled,
      }),
      origin.OriginIpOrDomain
    );
  };

  const handleDeleteUpstream = async (origin: string) => {
    if (!confirm(`Delete upstream "${origin}"?`)) return;
    await removeUpstream.mutateAsync({ origin });
  };

  const handleAddVdir = async () => {
    await addVdirMutation.mutateAsync(vdirForm);
    setShowAddVdirDialog(false);
    setVdirForm({
      matchingPath: "",
      domain: "",
      requireTLS: false,
      skipCertValidation: false,
    });
  };

  const handleDeleteVdir = async (matchingPath: string) => {
    if (!confirm(`Delete virtual directory "${matchingPath}"?`)) return;
    await removeVdirMutation.mutateAsync({ matchingPath });
  };

  const handleAddHeaderRule = async () => {
    await addHeaderMutation.mutateAsync(headerForm);
    setShowAddHeaderDialog(false);
    setHeaderForm({
      direction: "upstream",
      key: "",
      value: "",
      isRemove: false,
    });
  };

  const handleDeleteHeaderRule = async (rule: ZoraxyHeaderRewriteRule) => {
    if (!confirm(`Delete header rule "${rule.Direction}: ${rule.Key}"?`)) return;
    await removeHeaderMutation.mutateAsync({
      direction: rule.Direction,
      key: rule.Key,
    });
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

  if (!proxy) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p className="text-zinc-500">Proxy rule not found</p>
          <Link href={`/nodes/${id}/proxies`} className="mt-4 inline-block">
            <Button variant="outline">Back to Proxy Rules</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/nodes/${id}/proxies`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight font-mono">
                {decodedDomain}
              </h2>
              <Badge variant={proxy.Disabled ? "secondary" : "success"}>
                {proxy.Disabled ? "Disabled" : "Active"}
              </Badge>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">
              {node?.name ?? "Loading..."} ·{" "}
              {proxy.ProxyType === "subd" ? "Subdomain" : "Virtual Directory"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Proxy Type
              </p>
              <p className="mt-1 font-semibold capitalize">
                {proxy.ProxyType === "subd" ? "Subdomain" : "Virtual Dir"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Active Origins
              </p>
              <p className="mt-1 font-semibold">
                {proxy.ActiveOrigins?.length ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Load Balance
              </p>
              <p className="mt-1 font-semibold">
                {proxy.UseActiveLoadBalance ? "Enabled" : "Disabled"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sticky Session
              </p>
              <p className="mt-1 font-semibold">
                {proxy.UseStickySession ? "Enabled" : "Disabled"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="upstreams">Upstreams</TabsTrigger>
            <TabsTrigger value="vdirs">Virtual Dirs</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="raw">
              <Code className="mr-1 h-3.5 w-3.5" />
              Raw Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              {proxy.Tags && proxy.Tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {proxy.Tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Configuration Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
                    {JSON.stringify(proxy, null, 2)}
                  </pre>
                  <p className="mt-3 text-xs text-zinc-500">
                    Use the <strong>Raw Editor</strong> tab to edit the full JSON configuration directly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upstreams">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Origins (Upstreams)</CardTitle>
                <Button onClick={() => setShowAddUpstreamDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Add Upstream
                </Button>
              </CardHeader>
              <CardContent>
                {upstreamRows.length > 0 ? (
                  <div className="space-y-3">
                    {upstreamRows.map((origin) => (
                      <div
                        key={`${origin.OriginIpOrDomain}-${origin.Weight}-${origin.Disabled ? "disabled" : "active"}`}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Server className="h-4 w-4 text-zinc-400" />
                            <div>
                              <p className="font-mono text-sm font-medium">{origin.OriginIpOrDomain}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {origin.RequireTLS && (
                                  <Badge variant="success" className="text-[10px]">
                                    TLS
                                  </Badge>
                                )}
                                {origin.SkipCertValidations && (
                                  <Badge variant="warning" className="text-[10px]">
                                    Skip Cert
                                  </Badge>
                                )}
                                <Badge variant={origin.Disabled ? "secondary" : "success"} className="text-[10px]">
                                  {origin.Disabled ? "Disabled" : "Active"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditUpstream(origin)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUpstream(origin)}
                            >
                              {origin.Disabled ? "Enable" : "Disable"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUpstream(origin.OriginIpOrDomain)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                            <span>Weight</span>
                            <span>{origin.Weight}</span>
                          </div>
                          <div className="h-2 rounded bg-zinc-200 dark:bg-zinc-800">
                            <div
                              className="h-full rounded bg-zinc-900 dark:bg-zinc-100"
                              style={{ width: `${origin.Weight}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-500">No upstreams configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vdirs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Virtual Directories</CardTitle>
                <Button onClick={() => setShowAddVdirDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Add Virtual Directory
                </Button>
              </CardHeader>
              <CardContent>
                {proxy.VirtualDirectories && proxy.VirtualDirectories.length > 0 ? (
                  <div className="space-y-2">
                    {proxy.VirtualDirectories.map((vdir: ZoraxyVirtualDirectory) => (
                      <div
                        key={`${vdir.MatchingPath}-${vdir.Domain}`}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div>
                          <p className="font-mono text-sm">{vdir.MatchingPath} → {vdir.Domain}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {vdir.RequireTLS && <Badge variant="success">RequireTLS</Badge>}
                            {vdir.SkipCertValidations && <Badge variant="warning">SkipCertValidation</Badge>}
                            <Badge variant={vdir.Disabled ? "secondary" : "success"}>
                              {vdir.Disabled ? "Disabled" : "Active"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVdir(vdir.MatchingPath)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-500">No virtual directories</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="headers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Header Rewrite Rules</CardTitle>
                <Button onClick={() => setShowAddHeaderDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Add Header Rule
                </Button>
              </CardHeader>
              <CardContent>
                {proxy.HeaderRewriteRules && proxy.HeaderRewriteRules.length > 0 ? (
                  <div className="space-y-2">
                    {proxy.HeaderRewriteRules.map((rule: ZoraxyHeaderRewriteRule, index) => (
                      <div
                        key={`${rule.Direction}-${rule.Key}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="font-mono text-sm">
                          <span className="text-zinc-500">{rule.Direction}:</span>{" "}
                          <span className="font-medium">{rule.Key}</span>
                          {!rule.IsRemove && (
                            <>
                              {" = "}
                              <span className="text-emerald-600 dark:text-emerald-400">{rule.Value}</span>
                            </>
                          )}
                          {rule.IsRemove && <Badge className="ml-2" variant="danger">Remove</Badge>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteHeaderRule(rule)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-500">No header rewrite rules</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Raw JSON Editor</CardTitle>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Edit the full proxy configuration as JSON. Changes are sent to the Zoraxy API on save.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rawJsonDirty && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRawJsonReset}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Reset
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleRawJsonSave}
                    disabled={!rawJsonDirty || !!rawJsonError || editProxy.isPending}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" />
                    {editProxy.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rawJsonError && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-mono text-xs">{rawJsonError}</span>
                  </div>
                )}
                {rawJsonSaved && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <Check className="h-4 w-4 shrink-0" />
                    Configuration saved successfully.
                  </div>
                )}
                <textarea
                  className="min-h-[500px] w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
                  value={rawJson}
                  onChange={(e) => handleRawJsonChange(e.target.value)}
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {rawJsonDirty ? (
                      <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                    ) : (
                      "No changes"
                    )}
                  </span>
                  <span>{rawJson.split("\n").length} lines</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Proxy Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <span>Use Sticky Session</span>
                    <input
                      type="checkbox"
                      checked={settings.useStickySession}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, useStickySession: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <span>Use Active Load Balance</span>
                    <input
                      type="checkbox"
                      checked={settings.useActiveLoadBalance}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          useActiveLoadBalance: e.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <span>Bypass Global TLS</span>
                    <input
                      type="checkbox"
                      checked={settings.bypassGlobalTLS}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, bypassGlobalTLS: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <span>Disabled</span>
                    <input
                      type="checkbox"
                      checked={settings.disabled}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, disabled: e.target.checked }))
                      }
                    />
                  </label>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveSettings} disabled={editProxy.isPending}>
                      <Save className="h-4 w-4" />
                      {editProxy.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                    {settingsMessage && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">{settingsMessage}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Domain Aliases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="alias.example.com"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                    />
                    <Button onClick={handleAddAlias} disabled={!aliasInput.trim() || editProxy.isPending}>
                      <Plus className="h-4 w-4" />
                      Add Alias
                    </Button>
                  </div>
                  {aliases.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {aliases.map((alias) => (
                        <div
                          key={alias}
                          className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-800"
                        >
                          <Badge variant="secondary" className="font-mono">
                            {alias}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveAlias(alias)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No aliases configured</p>
                  )}
                  {aliasMessage && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{aliasMessage}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showAddUpstreamDialog} onOpenChange={setShowAddUpstreamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Upstream</DialogTitle>
              <DialogDescription>Add a new upstream origin for this proxy rule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="192.168.1.10:8080 or backend.example.com"
                value={upstreamForm.origin}
                onChange={(e) => setUpstreamForm((prev) => ({ ...prev, origin: e.target.value }))}
              />
              <label className="flex items-center justify-between text-sm">
                Require TLS
                <input
                  type="checkbox"
                  checked={upstreamForm.requireTLS}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({ ...prev, requireTLS: e.target.checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                Skip Cert Validation
                <input
                  type="checkbox"
                  checked={upstreamForm.skipCertValidation}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({
                      ...prev,
                      skipCertValidation: e.target.checked,
                    }))
                  }
                />
              </label>
              <div>
                <label className="mb-1 block text-sm font-medium">Weight ({upstreamForm.weight})</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={upstreamForm.weight}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({ ...prev, weight: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddUpstreamDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddUpstream}
                disabled={!upstreamForm.origin || addUpstream.isPending}
              >
                {addUpstream.isPending ? "Adding..." : "Add Upstream"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditUpstreamDialog} onOpenChange={setShowEditUpstreamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Upstream</DialogTitle>
              <DialogDescription>Update upstream settings and status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="192.168.1.10:8080 or backend.example.com"
                value={upstreamForm.origin}
                onChange={(e) => setUpstreamForm((prev) => ({ ...prev, origin: e.target.value }))}
              />
              <label className="flex items-center justify-between text-sm">
                Require TLS
                <input
                  type="checkbox"
                  checked={upstreamForm.requireTLS}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({ ...prev, requireTLS: e.target.checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                Skip Cert Validation
                <input
                  type="checkbox"
                  checked={upstreamForm.skipCertValidation}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({
                      ...prev,
                      skipCertValidation: e.target.checked,
                    }))
                  }
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                Disabled
                <input
                  type="checkbox"
                  checked={upstreamForm.disabled}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({ ...prev, disabled: e.target.checked }))
                  }
                />
              </label>
              <div>
                <label className="mb-1 block text-sm font-medium">Weight ({upstreamForm.weight})</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={upstreamForm.weight}
                  onChange={(e) =>
                    setUpstreamForm((prev) => ({ ...prev, weight: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditUpstreamDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveUpstreamEdit} disabled={!upstreamForm.origin || editProxy.isPending}>
                <Check className="h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddVdirDialog} onOpenChange={setShowAddVdirDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Virtual Directory</DialogTitle>
              <DialogDescription>Add a matching path and backend domain mapping.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="/api"
                value={vdirForm.matchingPath}
                onChange={(e) => setVdirForm((prev) => ({ ...prev, matchingPath: e.target.value }))}
              />
              <Input
                placeholder="backend.example.com"
                value={vdirForm.domain}
                onChange={(e) => setVdirForm((prev) => ({ ...prev, domain: e.target.value }))}
              />
              <label className="flex items-center justify-between text-sm">
                Require TLS
                <input
                  type="checkbox"
                  checked={vdirForm.requireTLS}
                  onChange={(e) =>
                    setVdirForm((prev) => ({ ...prev, requireTLS: e.target.checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                Skip Cert Validation
                <input
                  type="checkbox"
                  checked={vdirForm.skipCertValidation}
                  onChange={(e) =>
                    setVdirForm((prev) => ({
                      ...prev,
                      skipCertValidation: e.target.checked,
                    }))
                  }
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddVdirDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddVdir}
                disabled={!vdirForm.matchingPath || !vdirForm.domain || addVdirMutation.isPending}
              >
                {addVdirMutation.isPending ? "Adding..." : "Add Virtual Directory"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddHeaderDialog} onOpenChange={setShowAddHeaderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Header Rule</DialogTitle>
              <DialogDescription>Add or remove a header rewrite rule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Direction</label>
                <select
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={headerForm.direction}
                  onChange={(e) =>
                    setHeaderForm((prev) => ({ ...prev, direction: e.target.value }))
                  }
                >
                  <option value="upstream">upstream</option>
                  <option value="downstream">downstream</option>
                </select>
              </div>
              <Input
                placeholder="X-Forwarded-For"
                value={headerForm.key}
                onChange={(e) => setHeaderForm((prev) => ({ ...prev, key: e.target.value }))}
              />
              <Input
                placeholder="Header value"
                value={headerForm.value}
                onChange={(e) => setHeaderForm((prev) => ({ ...prev, value: e.target.value }))}
                disabled={headerForm.isRemove}
              />
              <label className="flex items-center justify-between text-sm">
                Is Remove Rule
                <input
                  type="checkbox"
                  checked={headerForm.isRemove}
                  onChange={(e) =>
                    setHeaderForm((prev) => ({ ...prev, isRemove: e.target.checked }))
                  }
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddHeaderDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddHeaderRule}
                disabled={!headerForm.key || addHeaderMutation.isPending}
              >
                {addHeaderMutation.isPending ? "Adding..." : "Add Header Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Search,
  Globe,
  ExternalLink,
  Pencil,
  RefreshCw,
  Filter,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import {
  useProxyRules,
  useAddProxyRule,
  useDeleteProxyRule,
  useToggleProxyRule,
  useEditProxyRule,
} from "@/hooks/use-proxies";
import { useNode } from "@/hooks/use-nodes";

function headerRuleCount(rules: unknown): number {
  if (Array.isArray(rules)) return rules.length;
  if (rules && typeof rules === "object" && "UserDefinedHeaders" in rules) {
    const headers = (rules as { UserDefinedHeaders: unknown }).UserDefinedHeaders;
    return Array.isArray(headers) ? headers.length : 0;
  }
  return 0;
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

export default function ProxiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const { data: proxies, isLoading, isFetching, refetch } = useProxyRules(id);
  const addProxy = useAddProxyRule(id);
  const deleteProxy = useDeleteProxyRule(id);
  const toggleProxy = useToggleProxyRule(id);
  const editProxy = useEditProxyRule(id);

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newProxy, setNewProxy] = useState({
    rootOrMatchingDomain: "",
    proxyType: "subd" as "subd" | "vdir",
    originIp: "",
    requireTLS: false,
    skipCertValidation: false,
    tags: "",
    useStickySession: false,
    useActiveLoadBalance: false,
  });
  const [editingProxy, setEditingProxy] = useState<{
    domain: string;
    disabled: boolean;
    useStickySession: boolean;
    useActiveLoadBalance: boolean;
    bypassGlobalTLS: boolean;
    tags: string;
  } | null>(null);

  const allTags = useMemo(() => {
    if (!proxies) return [];
    return Array.from(
      new Set(
        proxies.flatMap((proxy) =>
          (proxy.Tags ?? []).filter((tag) => tag.trim().length > 0)
        )
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [proxies]);

  const filtered = useMemo(() => {
    if (!proxies) return [];
    return proxies.filter((proxy) => {
      const searchMatch = proxy.RootOrMatchingDomain.toLowerCase().includes(
        search.toLowerCase()
      );
      const tagMatch =
        tagFilter === "all" || (proxy.Tags ?? []).includes(tagFilter);
      return searchMatch && tagMatch;
    });
  }, [proxies, search, tagFilter]);

  const handleAdd = async () => {
    await addProxy.mutateAsync({
      proxyType: newProxy.proxyType,
      rootOrMatchingDomain: newProxy.rootOrMatchingDomain,
      origin: newProxy.originIp,
      requireTLS: newProxy.requireTLS,
      skipCertValidation: newProxy.skipCertValidation,
      tags: parseTags(newProxy.tags),
      useStickySession: newProxy.useStickySession,
      useActiveLoadBalance: newProxy.useActiveLoadBalance,
    });
    setShowAddDialog(false);
    setNewProxy({
      rootOrMatchingDomain: "",
      proxyType: "subd",
      originIp: "",
      requireTLS: false,
      skipCertValidation: false,
      tags: "",
      useStickySession: false,
      useActiveLoadBalance: false,
    });
  };

  const handleDelete = async (domain: string) => {
    if (!confirm(`Delete proxy rule for "${domain}"?`)) return;
    await deleteProxy.mutateAsync(domain);
  };

  const handleOpenEdit = (domain: string) => {
    const target = proxies?.find((proxy) => proxy.RootOrMatchingDomain === domain);
    if (!target) return;

    setEditingProxy({
      domain: target.RootOrMatchingDomain,
      disabled: target.Disabled,
      useStickySession: target.UseStickySession,
      useActiveLoadBalance: target.UseActiveLoadBalance,
      bypassGlobalTLS: target.BypassGlobalTLS,
      tags: (target.Tags ?? []).join(", "),
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProxy) return;

    await editProxy.mutateAsync({
      domain: editingProxy.domain,
      updates: {
        disabled: editingProxy.disabled,
        useStickySession: editingProxy.useStickySession,
        useActiveLoadBalance: editingProxy.useActiveLoadBalance,
        bypassGlobalTLS: editingProxy.bypassGlobalTLS,
        tags: parseTags(editingProxy.tags),
      },
    });

    setShowEditDialog(false);
    setEditingProxy(null);
  };

  const totalCount = proxies?.length ?? 0;
  const filteredCount = filtered.length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/nodes/${id}`}>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight">Proxy Rules</h2>
              <p className="text-zinc-500 dark:text-zinc-400 truncate">
                {node?.name ?? "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search proxy rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-zinc-400" />
                  <SelectValue placeholder="Filter by tag" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="h-9 px-3 text-xs">
            {filteredCount === totalCount
              ? `${totalCount} rule${totalCount === 1 ? "" : "s"}`
              : `${filteredCount} of ${totalCount} rules`}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((proxy) => (
              <Card key={proxy.RootOrMatchingDomain}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          proxy.Disabled
                            ? "bg-zinc-100 dark:bg-zinc-800"
                            : "bg-emerald-100 dark:bg-emerald-900/30"
                        }`}
                      >
                        <Globe
                          className={`h-5 w-5 ${
                            proxy.Disabled
                              ? "text-zinc-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium font-mono text-sm truncate">
                            {proxy.RootOrMatchingDomain}
                          </p>
                          <Badge
                            variant={proxy.Disabled ? "secondary" : "success"}
                            className="text-[10px]"
                          >
                            {proxy.Disabled ? "Disabled" : "Active"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {proxy.ProxyType === "subd" ? "Subdomain" : "Virtual Dir"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>
                            {proxy.ActiveOrigins?.length ?? 0} origin
                            {(proxy.ActiveOrigins?.length ?? 0) !== 1 ? "s" : ""}
                          </span>
                          <span>
                            {proxy.VirtualDirectories?.length ?? 0} virtual director
                            {(proxy.VirtualDirectories?.length ?? 0) !== 1 ? "ies" : "y"}
                          </span>
                          <span>
                            {headerRuleCount(proxy.HeaderRewriteRules)} header rule
                            {headerRuleCount(proxy.HeaderRewriteRules) !== 1 ? "s" : ""}
                          </span>
                          {proxy.ActiveOrigins?.[0] && (
                            <span className="font-mono">
                              {proxy.ActiveOrigins[0].OriginIpOrDomain}
                            </span>
                          )}
                          {proxy.UseActiveLoadBalance && (
                            <Badge variant="secondary" className="text-[10px]">
                              Load Balanced
                            </Badge>
                          )}
                          {proxy.UseStickySession && (
                            <Badge variant="secondary" className="text-[10px]">
                              Sticky
                            </Badge>
                          )}
                          {(proxy.Tags ?? []).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="inline-flex items-center gap-1 text-[10px]"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <Link
                        href={`/nodes/${id}/proxies/${encodeURIComponent(
                          proxy.RootOrMatchingDomain
                        )}`}
                      >
                        <Button variant="ghost" size="icon" title="Details">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => handleOpenEdit(proxy.RootOrMatchingDomain)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={proxy.Disabled ? "Enable" : "Disable"}
                        onClick={() =>
                          toggleProxy.mutate({
                            domain: proxy.RootOrMatchingDomain,
                            enabled: proxy.Disabled,
                          })
                        }
                      >
                        {proxy.Disabled ? (
                          <Power className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-amber-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => handleDelete(proxy.RootOrMatchingDomain)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Globe className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No proxy rules</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {search || tagFilter !== "all"
                  ? "No rules match your current filters"
                  : "Add your first proxy rule to get started"}
              </p>
              {!search && tagFilter === "all" && (
                <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Add Rule
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Proxy Rule</DialogTitle>
              <DialogDescription>
                Create a new reverse proxy rule on this node.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Proxy Type</label>
                <Select
                  value={newProxy.proxyType}
                  onValueChange={(value) =>
                    setNewProxy({ ...newProxy, proxyType: value as "subd" | "vdir" })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subd">Subdomain / Domain</SelectItem>
                    <SelectItem value="vdir">Virtual Directory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {newProxy.proxyType === "subd" ? "Domain / Subdomain" : "Matching Path"}
                </label>
                <Input
                  className="mt-1"
                  placeholder={newProxy.proxyType === "subd" ? "app.example.com" : "/api"}
                  value={newProxy.rootOrMatchingDomain}
                  onChange={(e) =>
                    setNewProxy({ ...newProxy, rootOrMatchingDomain: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Origin (Backend)</label>
                <Input
                  className="mt-1"
                  placeholder="localhost:3000 or 192.168.1.10:8080"
                  value={newProxy.originIp}
                  onChange={(e) => setNewProxy({ ...newProxy, originIp: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  className="mt-1"
                  placeholder="prod, web, tenant-a"
                  value={newProxy.tags}
                  onChange={(e) => setNewProxy({ ...newProxy, tags: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newProxy.requireTLS}
                    onChange={(e) =>
                      setNewProxy({ ...newProxy, requireTLS: e.target.checked })
                    }
                    className="rounded"
                  />
                  Origin requires TLS (HTTPS)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newProxy.skipCertValidation}
                    onChange={(e) =>
                      setNewProxy({
                        ...newProxy,
                        skipCertValidation: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  Skip certificate validation
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newProxy.useStickySession}
                    onChange={(e) =>
                      setNewProxy({
                        ...newProxy,
                        useStickySession: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  Enable sticky session
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newProxy.useActiveLoadBalance}
                    onChange={(e) =>
                      setNewProxy({
                        ...newProxy,
                        useActiveLoadBalance: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  Enable active load balance
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={
                  !newProxy.rootOrMatchingDomain || !newProxy.originIp || addProxy.isPending
                }
              >
                {addProxy.isPending ? "Adding..." : "Add Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setEditingProxy(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Proxy Rule</DialogTitle>
              <DialogDescription>Adjust runtime settings for this rule.</DialogDescription>
            </DialogHeader>
            {editingProxy && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-zinc-500">Domain</p>
                  <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {editingProxy.domain}
                  </p>
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingProxy.disabled}
                      onChange={(e) =>
                        setEditingProxy({ ...editingProxy, disabled: e.target.checked })
                      }
                      className="rounded"
                    />
                    Disabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingProxy.useStickySession}
                      onChange={(e) =>
                        setEditingProxy({
                          ...editingProxy,
                          useStickySession: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    UseStickySession
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingProxy.useActiveLoadBalance}
                      onChange={(e) =>
                        setEditingProxy({
                          ...editingProxy,
                          useActiveLoadBalance: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    UseActiveLoadBalance
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingProxy.bypassGlobalTLS}
                      onChange={(e) =>
                        setEditingProxy({
                          ...editingProxy,
                          bypassGlobalTLS: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    BypassGlobalTLS
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium">Tags (comma-separated)</label>
                  <Input
                    className="mt-1"
                    placeholder="prod, web, tenant-a"
                    value={editingProxy.tags}
                    onChange={(e) =>
                      setEditingProxy({ ...editingProxy, tags: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingProxy(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editingProxy || editProxy.isPending}>
                {editProxy.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/layout/app-shell";
import { useNode } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccessRule } from "@/types/api";

interface AccessEntry {
  ip: string;
  comment?: string;
}

function normalizeEntries(data: unknown): AccessEntry[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item): AccessEntry | null => {
      if (typeof item === "string") {
        return { ip: item };
      }

      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const ip =
          (typeof obj.IP === "string" && obj.IP) ||
          (typeof obj.ip === "string" && obj.ip) ||
          (typeof obj.Address === "string" && obj.Address) ||
          (typeof obj.address === "string" && obj.address) ||
          (typeof obj.CIDR === "string" && obj.CIDR) ||
          (typeof obj.cidr === "string" && obj.cidr) ||
          "";

        if (!ip) return null;

        const comment =
          (typeof obj.Comment === "string" && obj.Comment) ||
          (typeof obj.comment === "string" && obj.comment) ||
          "";

        return { ip, comment };
      }

      return null;
    })
    .filter((entry): entry is AccessEntry => entry !== null);
}

function RuleAccessDetail({ nodeId, rule }: { nodeId: string; rule: AccessRule }) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [showAddBlacklist, setShowAddBlacklist] = useState(false);
  const [showAddWhitelist, setShowAddWhitelist] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({ ip: "", comment: "" });
  const [whitelistForm, setWhitelistForm] = useState({ ip: "", comment: "" });

  const encodedRuleId = encodeURIComponent(rule.ID);
  const blacklistPath = `/api/v1/nodes/${nodeId}/access/${encodedRuleId}/blacklist`;
  const whitelistPath = `/api/v1/nodes/${nodeId}/access/${encodedRuleId}/whitelist`;

  const blacklistQuery = useQuery({
    queryKey: ["nodes", nodeId, "access", rule.ID, "blacklist"],
    queryFn: () => api.get<unknown>(blacklistPath),
  });

  const whitelistQuery = useQuery({
    queryKey: ["nodes", nodeId, "access", rule.ID, "whitelist"],
    queryFn: () => api.get<unknown>(whitelistPath),
  });

  const blacklistEntries = useMemo(
    () => normalizeEntries(blacklistQuery.data),
    [blacklistQuery.data]
  );
  const whitelistEntries = useMemo(
    () => normalizeEntries(whitelistQuery.data),
    [whitelistQuery.data]
  );

  const addBlacklist = useMutation({
    mutationFn: (payload: { ip: string; comment: string }) =>
      api.post(blacklistPath, payload),
    onSuccess: async () => {
      setShowAddBlacklist(false);
      setBlacklistForm({ ip: "", comment: "" });
      await queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "access", rule.ID, "blacklist"],
      });
    },
  });

  const addWhitelist = useMutation({
    mutationFn: (payload: { ip: string; comment: string }) =>
      api.post(whitelistPath, payload),
    onSuccess: async () => {
      setShowAddWhitelist(false);
      setWhitelistForm({ ip: "", comment: "" });
      await queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "access", rule.ID, "whitelist"],
      });
    },
  });

  const removeBlacklist = useMutation({
    mutationFn: (ip: string) => api.del(blacklistPath, { ip }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "access", rule.ID, "blacklist"],
      });
    },
  });

  const removeWhitelist = useMutation({
    mutationFn: (ip: string) => api.del(whitelistPath, { ip }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["nodes", nodeId, "access", rule.ID, "whitelist"],
      });
    },
  });

  return (
    <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <p className="font-medium text-sm">Blacklist</p>
                <Badge variant={rule.BlacklistEnabled ? "danger" : "secondary"} className="text-[10px]">
                  {rule.BlacklistEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddBlacklist(true)}
                disabled={!rule.BlacklistEnabled}
              >
                <Plus className="h-4 w-4" />
                Add to Blacklist
              </Button>
            </div>

            {blacklistQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : blacklistEntries.length > 0 ? (
              <div className="space-y-2">
                {blacklistEntries.map((entry, index) => (
                  <div
                    key={`${entry.ip}-${index}`}
                    className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                  >
                    <div>
                      <p className="font-mono text-xs">{entry.ip}</p>
                      {entry.comment ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.comment}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBlacklist.mutate(entry.ip)}
                      title="Remove from blacklist"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Ban className="h-4 w-4" />
                <span>No blacklist entries</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <p className="font-medium text-sm">Whitelist</p>
                <Badge variant={rule.WhitelistEnabled ? "success" : "secondary"} className="text-[10px]">
                  {rule.WhitelistEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddWhitelist(true)}
                disabled={!rule.WhitelistEnabled}
              >
                <Plus className="h-4 w-4" />
                Add to Whitelist
              </Button>
            </div>

            {whitelistQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : whitelistEntries.length > 0 ? (
              <div className="space-y-2">
                {whitelistEntries.map((entry, index) => (
                  <div
                    key={`${entry.ip}-${index}`}
                    className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                  >
                    <div>
                      <p className="font-mono text-xs">{entry.ip}</p>
                      {entry.comment ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.comment}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWhitelist.mutate(entry.ip)}
                      title="Remove from whitelist"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>No whitelist entries</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddBlacklist} onOpenChange={setShowAddBlacklist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Blacklist</DialogTitle>
            <DialogDescription>
              Add an IP address or CIDR block to rule &quot;{rule.Name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">IP/CIDR</label>
              <Input
                className="mt-1"
                placeholder="203.0.113.10 or 203.0.113.0/24"
                value={blacklistForm.ip}
                onChange={(e) =>
                  setBlacklistForm({ ...blacklistForm, ip: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Comment</label>
              <Input
                className="mt-1"
                placeholder="Optional note"
                value={blacklistForm.comment}
                onChange={(e) =>
                  setBlacklistForm({ ...blacklistForm, comment: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBlacklist(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addBlacklist.mutate(blacklistForm)}
              disabled={!blacklistForm.ip || addBlacklist.isPending}
            >
              {addBlacklist.isPending ? "Adding..." : "Add to Blacklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddWhitelist} onOpenChange={setShowAddWhitelist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Whitelist</DialogTitle>
            <DialogDescription>
              Add an IP address or CIDR block to rule &quot;{rule.Name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">IP/CIDR</label>
              <Input
                className="mt-1"
                placeholder="203.0.113.10 or 203.0.113.0/24"
                value={whitelistForm.ip}
                onChange={(e) =>
                  setWhitelistForm({ ...whitelistForm, ip: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Comment</label>
              <Input
                className="mt-1"
                placeholder="Optional note"
                value={whitelistForm.comment}
                onChange={(e) =>
                  setWhitelistForm({ ...whitelistForm, comment: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWhitelist(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addWhitelist.mutate(whitelistForm)}
              disabled={!whitelistForm.ip || addWhitelist.isPending}
            >
              {addWhitelist.isPending ? "Adding..." : "Add to Whitelist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const api = useApi();
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["nodes", id, "access"],
    queryFn: () => api.get<AccessRule[]>(`/api/v1/nodes/${id}/access`),
    enabled: !!id,
  });

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
            <h2 className="text-2xl font-bold tracking-tight">Access Control</h2>
            <p className="text-zinc-500 dark:text-zinc-400">{node?.name ?? "Loading..."}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : rules && rules.length > 0 ? (
          <div className="space-y-3">
            {rules.map((rule) => {
              const expanded = expandedRuleId === rule.ID;
              return (
                <Card key={rule.ID}>
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-4 text-left"
                      onClick={() => setExpandedRuleId(expanded ? null : rule.ID)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          <Shield className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{rule.Name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant={rule.BlacklistEnabled ? "danger" : "secondary"}
                              className="text-[10px]"
                            >
                              Blacklist {rule.BlacklistEnabled ? "ON" : "OFF"}
                            </Badge>
                            <Badge
                              variant={rule.WhitelistEnabled ? "success" : "secondary"}
                              className="text-[10px]"
                            >
                              Whitelist {rule.WhitelistEnabled ? "ON" : "OFF"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-zinc-500" />
                      )}
                    </button>

                    {expanded ? <RuleAccessDetail nodeId={id} rule={rule} /> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No access rules</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Access rules are managed directly on the Zoraxy node
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

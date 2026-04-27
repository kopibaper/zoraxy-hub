"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { useNode } from "@/hooks/use-nodes";
import { useApi } from "@/hooks/use-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Redirect } from "@/types/api";

export default function RedirectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const api = useApi();
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [form, setForm] = useState({
    redirectUrl: "",
    destUrl: "",
    statusCode: "302",
    forwardChildpath: false,
  });

  const { data: redirects, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["nodes", id, "redirects"],
    queryFn: () => api.get<Redirect[]>(`/api/v1/nodes/${id}/redirects`),
    enabled: !!id,
  });

  const addRedirect = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/nodes/${id}/redirects`, {
        redirectUrl: form.redirectUrl,
        destUrl: form.destUrl,
        statusCode: Number(form.statusCode),
        forwardChildpath: form.forwardChildpath,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "redirects"] });
      setShowAddDialog(false);
      setForm({
        redirectUrl: "",
        destUrl: "",
        statusCode: "302",
        forwardChildpath: false,
      });
    },
  });

  const editRedirect = useMutation({
    mutationFn: () =>
      api.put(`/api/v1/nodes/${id}/redirects`, {
        id: editingRedirect?.ID,
        redirectUrl: form.redirectUrl,
        destUrl: form.destUrl,
        statusCode: Number(form.statusCode),
        forwardChildpath: form.forwardChildpath,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "redirects"] });
      setShowEditDialog(false);
      setEditingRedirect(null);
      setForm({
        redirectUrl: "",
        destUrl: "",
        statusCode: "302",
        forwardChildpath: false,
      });
    },
  });

  const deleteRedirect = useMutation({
    mutationFn: (redirectId: string) =>
      api.del(`/api/v1/nodes/${id}/redirects`, { id: redirectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "redirects"] });
    },
  });

  const isFormInvalid = useMemo(
    () => !form.redirectUrl || !form.destUrl,
    [form.destUrl, form.redirectUrl]
  );

  const openAddDialog = () => {
    setForm({
      redirectUrl: "",
      destUrl: "",
      statusCode: "302",
      forwardChildpath: false,
    });
    setShowAddDialog(true);
  };

  const openEditDialog = (redirect: Redirect) => {
    setEditingRedirect(redirect);
    setForm({
      redirectUrl: redirect.RedirectURL,
      destUrl: redirect.DestURL,
      statusCode: String(redirect.StatusCode),
      forwardChildpath: redirect.ForwardChildpath,
    });
    setShowEditDialog(true);
  };

  const handleDelete = async (redirect: Redirect) => {
    if (!confirm(`Delete redirect \"${redirect.RedirectURL}\"?`)) return;
    await deleteRedirect.mutateAsync(redirect.ID);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/nodes/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Redirections</h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                {node?.name ?? "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Redirect
            </Button>
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
        ) : redirects && redirects.length > 0 ? (
          <div className="space-y-3">
            {redirects.map((redirect) => (
              <Card key={redirect.ID}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium font-mono text-sm">
                        {redirect.RedirectURL}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono">{redirect.DestURL}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {redirect.StatusCode}
                        </Badge>
                        {redirect.ForwardChildpath && (
                          <Badge variant="secondary" className="text-[10px]">
                            Forward Path
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => openEditDialog(redirect)}
                    >
                      <Pencil className="h-4 w-4 text-zinc-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => void handleDelete(redirect)}
                      disabled={deleteRedirect.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ArrowRightLeft className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No redirections</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                URL redirections are managed on the Zoraxy node
              </p>
              <Button className="mt-4" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Add Redirect
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Redirect</DialogTitle>
              <DialogDescription>
                Create a new URL redirect rule on this node.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Source URL</label>
                <Input
                  className="mt-1"
                  placeholder="https://old.example.com"
                  value={form.redirectUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, redirectUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destination URL</label>
                <Input
                  className="mt-1"
                  placeholder="https://new.example.com"
                  value={form.destUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, destUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status Code</label>
                <Select
                  value={form.statusCode}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, statusCode: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301</SelectItem>
                    <SelectItem value="302">302</SelectItem>
                    <SelectItem value="307">307</SelectItem>
                    <SelectItem value="308">308</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="forward-childpath-add"
                  type="checkbox"
                  checked={form.forwardChildpath}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      forwardChildpath: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <label htmlFor="forward-childpath-add" className="text-sm">
                  Forward Child Path
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void addRedirect.mutateAsync()}
                disabled={isFormInvalid || addRedirect.isPending}
              >
                {addRedirect.isPending ? "Adding..." : "Add Redirect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingRedirect(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Redirect</DialogTitle>
              <DialogDescription>
                Update redirect source, target, and status settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Source URL</label>
                <Input
                  className="mt-1"
                  value={form.redirectUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, redirectUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destination URL</label>
                <Input
                  className="mt-1"
                  value={form.destUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, destUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status Code</label>
                <Select
                  value={form.statusCode}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, statusCode: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301</SelectItem>
                    <SelectItem value="302">302</SelectItem>
                    <SelectItem value="307">307</SelectItem>
                    <SelectItem value="308">308</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="forward-childpath-edit"
                  type="checkbox"
                  checked={form.forwardChildpath}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      forwardChildpath: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <label htmlFor="forward-childpath-edit" className="text-sm">
                  Forward Child Path
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void editRedirect.mutateAsync()}
                disabled={isFormInvalid || editRedirect.isPending || !editingRedirect}
              >
                {editRedirect.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

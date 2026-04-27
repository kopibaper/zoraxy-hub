"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Radio,
  Plus,
  Trash2,
  Play,
  Square,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { StreamProxy } from "@/types/api";

export default function StreamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const api = useApi();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStream, setNewStream] = useState({
    Name: "",
    Protocol: "tcp" as "tcp" | "udp",
    ListeningAddr: "0.0.0.0",
    ListeningPort: 0,
    ProxyAddr: "",
    ProxyPort: 0,
  });

  const { data: streams, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["nodes", id, "streams"],
    queryFn: () => api.get<StreamProxy[]>(`/api/v1/nodes/${id}/streams`),
    enabled: !!id,
  });

  const addStream = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/nodes/${id}/streams`, {
        Name: newStream.Name,
        Protocol: newStream.Protocol,
        ListeningAddr: newStream.ListeningAddr,
        ListeningPort: newStream.ListeningPort,
        ProxyAddr: newStream.ProxyAddr,
        ProxyPort: newStream.ProxyPort,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "streams"] });
      setShowAddDialog(false);
      setNewStream({
        Name: "",
        Protocol: "tcp",
        ListeningAddr: "0.0.0.0",
        ListeningPort: 0,
        ProxyAddr: "",
        ProxyPort: 0,
      });
    },
  });

  const deleteStream = useMutation({
    mutationFn: (streamId: string) =>
      api.del(`/api/v1/nodes/${id}/streams`, { id: streamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "streams"] });
    },
  });

  const toggleStream = useMutation({
    mutationFn: ({ streamId, running }: { streamId: string; running: boolean }) =>
      api.post(`/api/v1/nodes/${id}/streams/toggle`, { streamId, running }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes", id, "streams"] });
    },
  });

  const handleAdd = async () => {
    await addStream.mutateAsync();
  };

  const handleDelete = async (stream: StreamProxy) => {
    if (!confirm(`Delete stream proxy \"${stream.Name}\"?`)) return;
    await deleteStream.mutateAsync(stream.ID);
  };

  const handleToggle = async (stream: StreamProxy) => {
    await toggleStream.mutateAsync({
      streamId: stream.ID,
      running: stream.Running,
    });
  };

  const isFormInvalid =
    !newStream.Name ||
    !newStream.ListeningAddr ||
    !newStream.ProxyAddr ||
    newStream.ListeningPort <= 0 ||
    newStream.ProxyPort <= 0;

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
              <h2 className="text-2xl font-bold tracking-tight">Stream Proxy</h2>
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
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Stream
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
        ) : streams && streams.length > 0 ? (
          <div className="space-y-3">
            {streams.map((stream) => (
              <Card key={stream.ID}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        stream.Running
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-zinc-100 dark:bg-zinc-800"
                      }`}
                    >
                      <Radio
                        className={`h-5 w-5 ${
                          stream.Running
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{stream.Name}</p>
                        <Badge
                          variant={stream.Running ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {stream.Running ? "Running" : "Stopped"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {stream.Protocol.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {stream.ListeningAddr}:{stream.ListeningPort} →{" "}
                        {stream.ProxyAddr}:{stream.ProxyPort}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={stream.Running ? "Stop" : "Start"}
                      onClick={() => void handleToggle(stream)}
                      disabled={toggleStream.isPending}
                    >
                      {stream.Running ? (
                        <Square className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => void handleDelete(stream)}
                      disabled={deleteStream.isPending}
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
              <Radio className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No stream proxies</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                TCP/UDP stream proxies are managed on the Zoraxy node
              </p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4" />
                Add Stream
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stream Proxy</DialogTitle>
              <DialogDescription>
                Create a TCP/UDP stream proxy on this node.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  className="mt-1"
                  placeholder="My stream proxy"
                  value={newStream.Name}
                  onChange={(e) =>
                    setNewStream((prev) => ({ ...prev, Name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Protocol</label>
                <Select
                  value={newStream.Protocol}
                  onValueChange={(value: "tcp" | "udp") =>
                    setNewStream((prev) => ({ ...prev, Protocol: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select protocol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Listening Address</label>
                <Input
                  className="mt-1"
                  value={newStream.ListeningAddr}
                  onChange={(e) =>
                    setNewStream((prev) => ({
                      ...prev,
                      ListeningAddr: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Listening Port</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={newStream.ListeningPort || ""}
                  onChange={(e) =>
                    setNewStream((prev) => ({
                      ...prev,
                      ListeningPort: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Proxy Target Address</label>
                <Input
                  className="mt-1"
                  placeholder="127.0.0.1"
                  value={newStream.ProxyAddr}
                  onChange={(e) =>
                    setNewStream((prev) => ({ ...prev, ProxyAddr: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Proxy Target Port</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={newStream.ProxyPort || ""}
                  onChange={(e) =>
                    setNewStream((prev) => ({
                      ...prev,
                      ProxyPort: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAdd()}
                disabled={isFormInvalid || addStream.isPending}
              >
                {addStream.isPending ? "Adding..." : "Add Stream"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

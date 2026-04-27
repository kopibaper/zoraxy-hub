"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileCode,
  Trash2,
  Copy,
  Rocket,
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
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
} from "@/hooks/use-templates";

const typeLabels: Record<string, string> = {
  proxy_rule: "Proxy Rule",
  redirect: "Redirect",
  access_rule: "Access Rule",
  cert: "Certificate",
  stream: "Stream Proxy",
  full: "Full Config",
};

export default function TemplatesPage() {
  const router = useRouter();
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    type: "proxy_rule",
    config: "{}",
  });

  const handleCreate = async () => {
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(newTemplate.config);
    } catch {
      alert("Invalid JSON in config");
      return;
    }

    const result = await createTemplate.mutateAsync({
      name: newTemplate.name,
      description: newTemplate.description,
      type: newTemplate.type,
      config: parsedConfig,
    });
    setShowCreateDialog(false);
    setNewTemplate({ name: "", description: "", type: "proxy_rule", config: "{}" });
    if (result?.id) {
      router.push(`/templates/${result.id}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await deleteTemplate.mutateAsync(id);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Config Templates
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Reusable configuration templates for deploying to multiple nodes
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                        <FileCode className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <Link href={`/templates/${template.id}`}>
                          <p className="font-medium hover:underline">
                            {template.name}
                          </p>
                        </Link>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {typeLabels[template.type] ?? template.type}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(template.id, template.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                  {template.description && (
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/templates/${template.id}`}>
                      <Button variant="outline" size="sm">
                        <Copy className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/templates/${template.id}/deploy`}>
                      <Button size="sm">
                        <Rocket className="h-3.5 w-3.5" />
                        Deploy
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileCode}
            title="No templates"
            description="Create reusable config templates to deploy across nodes"
            actionLabel="Create Template"
            onAction={() => setShowCreateDialog(true)}
          />
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>
                Define a reusable configuration template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  className="mt-1"
                  placeholder="My Proxy Template"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  className="mt-1"
                  placeholder="Optional description"
                  value={newTemplate.description}
                  onChange={(e) =>
                    setNewTemplate({
                      ...newTemplate,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={newTemplate.type}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, type: e.target.value })
                  }
                >
                  <option value="proxy_rule">Proxy Rule</option>
                  <option value="redirect">Redirect</option>
                  <option value="access_rule">Access Rule</option>
                  <option value="cert">Certificate</option>
                  <option value="stream">Stream Proxy</option>
                  <option value="full">Full Config</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Config (JSON)
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-800 dark:bg-zinc-950 min-h-[120px]"
                  rows={6}
                  placeholder='{"proxyType": "subd", "rootOrMatchingDomain": "{{domain}}"}'
                  value={newTemplate.config}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, config: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Use {"{{variable}}"} syntax for template variables
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newTemplate.name || createTemplate.isPending}
              >
                {createTemplate.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

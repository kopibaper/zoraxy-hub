"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Rocket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/app-shell";
import {
  useTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/hooks/use-templates";

export default function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: template, isLoading } = useTemplate(id);
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const initialValues = useMemo(() => {
    if (!template) return { name: "", description: "", config: "" };
    return {
      name: template.name,
      description: template.description ?? "",
      config: typeof template.config === "string"
        ? template.config
        : JSON.stringify(template.config, null, 2),
    };
  }, [template]);

  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [config, setConfig] = useState(initialValues.config);

  // Sync form when template data changes (e.g. after refetch)
  useMemo(() => {
    if (template) {
      setName(initialValues.name);
      setDescription(initialValues.description);
      setConfig(initialValues.config);
    }
  }, [template, initialValues]);

  const handleSave = async () => {
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      alert("Invalid JSON in config");
      return;
    }

    await updateTemplate.mutateAsync({
      id,
      name,
      description,
      config: parsedConfig,
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await deleteTemplate.mutateAsync(id);
    router.push("/templates");
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </AppShell>
    );
  }

  if (!template) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p className="text-zinc-500">Template not found</p>
          <Link href="/templates" className="mt-4 inline-block">
            <Button variant="outline">Back to Templates</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/templates">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Edit Template
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{template.type}</Badge>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Created{" "}
                  {new Date(template.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/templates/${id}/deploy`}>
              <Button variant="outline">
                <Rocket className="h-4 w-4" />
                Deploy
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                className="mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Config (JSON)</label>
              <textarea
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-800 dark:bg-zinc-950"
                rows={16}
                value={config}
                onChange={(e) => setConfig(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Use {"{{variable}}"} syntax for template variables.
                Variables will be resolved during deployment.
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateTemplate.isPending}
              >
                <Save className="h-4 w-4" />
                {updateTemplate.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {template.variables && template.variables.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {template.variables.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div>
                      <code className="text-sm font-mono font-medium">
                        {`{{${v.name}}}`}
                      </code>
                      {v.description && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {v.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {v.required && (
                        <Badge variant="danger" className="text-[10px]">
                          Required
                        </Badge>
                      )}
                      {v.defaultValue && (
                        <Badge variant="secondary" className="text-[10px]">
                          Default: {v.defaultValue}
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
    </AppShell>
  );
}

"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Folder, FileText, Save, Trash2, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNode } from "@/hooks/use-nodes";
import {
  useDeleteFile,
  useFileContent,
  useFileList,
  useWriteFile,
} from "@/hooks/use-files";

function joinPath(basePath: string, name: string): string {
  if (basePath === ".") return name;
  return `${basePath}/${name}`;
}

function parentPath(path: string): string {
  if (path === ".") return ".";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "." : parts.join("/");
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export default function FilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);

  const [currentPath, setCurrentPath] = useState(".");
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: files = [], isLoading: filesLoading } = useFileList(id, currentPath);
  const { data: fileData, isLoading: contentLoading } = useFileContent(id, selectedFilePath);
  const writeFile = useWriteFile(id);
  const deleteFile = useDeleteFile(id);

  const sortedFiles = useMemo(
    () =>
      [...files].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      }),
    [files]
  );

  const breadcrumbParts = currentPath === "." ? [] : currentPath.split("/").filter(Boolean);

  const openEntry = (name: string, isDirectory: boolean) => {
    const nextPath = joinPath(currentPath, name);
    if (isDirectory) {
      setCurrentPath(nextPath);
      return;
    }
    setSelectedFilePath(nextPath);
  };

  const saveFile = async () => {
    if (!selectedFilePath) return;
    await writeFile.mutateAsync({
      path: selectedFilePath,
      content: editorRef.current?.value ?? "",
    });
  };

  const removeFile = async () => {
    if (!selectedFilePath) return;
    if (!confirm(`Delete file \"${selectedFilePath}\"?`)) return;
    await deleteFile.mutateAsync({ path: selectedFilePath });
    setSelectedFilePath(undefined);
  };

  const createFile = async () => {
    const cleanName = newFileName.trim();
    if (!cleanName) return;
    const fullPath = joinPath(currentPath, cleanName);
    await writeFile.mutateAsync({ path: fullPath, content: "" });
    setSelectedFilePath(fullPath);
    setNewFileName("");
    setShowNewFile(false);
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
            <h2 className="text-2xl font-bold tracking-tight">Config Files</h2>
            <p className="text-zinc-500 dark:text-zinc-400">{node?.name ?? "Loading..."}</p>
          </div>
        </div>

        {node?.connectionMode === "direct" ? (
          <Card>
            <CardContent className="py-10 text-center text-zinc-500 dark:text-zinc-400">
              File management requires agent mode
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="space-y-3">
                <CardTitle>Browser</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => {
                      setCurrentPath(".");
                      setSelectedFilePath(undefined);
                    }}
                  >
                    root
                  </button>
                  {breadcrumbParts.map((part, index) => {
                    const partial = breadcrumbParts.slice(0, index + 1).join("/");
                    return (
                      <span key={partial} className="flex items-center gap-2">
                        <span>/</span>
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline"
                          onClick={() => {
                            setCurrentPath(partial);
                            setSelectedFilePath(undefined);
                          }}
                        >
                          {part}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCurrentPath(parentPath(currentPath));
                      setSelectedFilePath(undefined);
                    }}
                    disabled={currentPath === "."}
                  >
                    Up
                  </Button>
                  <Button type="button" onClick={() => setShowNewFile(true)}>
                    <Plus className="h-4 w-4" />
                    Create New File
                  </Button>
                </div>
                {showNewFile && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="new-config.json"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                    />
                    <Button type="button" onClick={() => void createFile()}>
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNewFile(false);
                        setNewFileName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filesLoading ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading files...</p>
                ) : sortedFiles.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No files found</p>
                ) : (
                  <div className="space-y-1">
                    {sortedFiles.map((entry) => {
                      const fullPath = joinPath(currentPath, entry.name);
                      const selected = selectedFilePath === fullPath;
                      return (
                        <button
                          key={fullPath}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                            selected
                              ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                          }`}
                          onClick={() => openEntry(entry.name, entry.isDirectory)}
                        >
                          <span className="flex items-center gap-2">
                            {entry.isDirectory ? (
                              <Folder className="h-4 w-4 text-amber-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-zinc-500" />
                            )}
                            {entry.name}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {entry.isDirectory
                              ? "Folder"
                              : `${formatSize(entry.size)} • ${new Date(
                                  entry.modified * 1000
                                ).toLocaleString()}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedFilePath || "Select a file"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedFilePath ? (
                  <>
                    <textarea
                      key={selectedFilePath}
                      ref={editorRef}
                      className="h-[500px] w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900"
                      defaultValue={contentLoading ? "Loading..." : fileData?.content || ""}
                      spellCheck={false}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => void saveFile()} disabled={writeFile.isPending}>
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void removeFile()}
                        disabled={deleteFile.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Choose a file from the browser to edit it.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

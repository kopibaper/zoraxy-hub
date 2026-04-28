"use client";

import { useState, useCallback } from "react";
import {
  Terminal,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Key,
  Server,
  Container,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { useApi } from "@/hooks/use-api";

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `zhub_ak_${hex}`;
}

const TOTAL_STEPS = 4;

interface InstallerConfig {
  apiKey: string;
  agentPort: string;
  listenAddr: string;
  zoraxyHost: string;
  zoraxyPort: string;
  zoraxyUser: string;
  zoraxyPass: string;
  zoraxyDataDir: string;
  zoraxyMode: "docker" | "native";
  dockerContainer: string;
}

interface GeneratedScript {
  oneLiner: string;
  multiLine: string;
  scriptUrl: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isCompleted = step < current;

        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isCompleted
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : step}
            </div>
            {step < total && (
              <div
                className={`h-0.5 w-8 ${
                  isCompleted
                    ? "bg-emerald-300 dark:bg-emerald-700"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentInstallerPage() {
  const api = useApi();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<InstallerConfig>({
    apiKey: generateApiKey(),
    agentPort: "9191",
    listenAddr: "0.0.0.0",
    zoraxyHost: "localhost",
    zoraxyPort: "8000",
    zoraxyUser: "admin",
    zoraxyPass: "",
    zoraxyDataDir: "/opt/zoraxy",
    zoraxyMode: "docker",
    dockerContainer: "zoraxy",
  });
  const [generatedScript, setGeneratedScript] =
    useState<GeneratedScript | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const updateConfig = (field: keyof InstallerConfig, value: string) => {
    setConfig((c) => ({ ...c, [field]: value }));
    setGeneratedScript(null);
  };

  const handleGenerate = async () => {
    setError("");
    setGenerating(true);
    try {
      const result = await api.post<GeneratedScript>(
        "/api/v1/agent/install-script",
        {
          apiKey: config.apiKey,
          agentPort: parseInt(config.agentPort, 10),
          listenAddr: config.listenAddr,
          zoraxyHost: config.zoraxyHost,
          zoraxyPort: parseInt(config.zoraxyPort, 10),
          zoraxyUser: config.zoraxyUser,
          zoraxyPass: config.zoraxyPass || undefined,
          zoraxyDataDir: config.zoraxyDataDir,
          dockerEnabled: config.zoraxyMode === "docker",
          dockerContainer: config.dockerContainer,
        }
      );
      setGeneratedScript(result);
      setStep(4);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate script"
      );
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return config.apiKey.length >= 16;
      case 2:
        return (
          config.zoraxyHost.length > 0 &&
          parseInt(config.zoraxyPort, 10) > 0 &&
          config.zoraxyUser.length > 0
        );
      case 3:
        return parseInt(config.agentPort, 10) > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step === 3) {
      handleGenerate();
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Agent Installer
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Generate a one-line install command for remote VPS agent setup
          </p>
        </div>

        <div className="flex items-center justify-between">
          <StepIndicator current={step} total={TOTAL_STEPS} />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-4 w-4" />
                API Key
              </CardTitle>
              <CardDescription>
                The agent uses this key to authenticate requests from ZoraxyHub.
                Save it — you&apos;ll need it when adding this node.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent API Key</label>
                <div className="flex gap-2">
                  <Input
                    value={config.apiKey}
                    onChange={(e) => updateConfig("apiKey", e.target.value)}
                    className="font-mono text-sm"
                  />
                  <CopyButton text={config.apiKey} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => updateConfig("apiKey", generateApiKey())}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                Keep this key safe. You&apos;ll enter it in the &quot;Add
                Node&quot; form after installation.
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" />
                Zoraxy Instance
              </CardTitle>
              <CardDescription>
                How the agent connects to the Zoraxy reverse proxy on the same
                server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zoraxy Host</label>
                  <Input
                    value={config.zoraxyHost}
                    onChange={(e) =>
                      updateConfig("zoraxyHost", e.target.value)
                    }
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zoraxy Port</label>
                  <Input
                    type="number"
                    value={config.zoraxyPort}
                    onChange={(e) =>
                      updateConfig("zoraxyPort", e.target.value)
                    }
                    placeholder="8000"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Zoraxy Username
                  </label>
                  <Input
                    value={config.zoraxyUser}
                    onChange={(e) =>
                      updateConfig("zoraxyUser", e.target.value)
                    }
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Zoraxy Password
                  </label>
                  <Input
                    type="password"
                    value={config.zoraxyPass}
                    onChange={(e) =>
                      updateConfig("zoraxyPass", e.target.value)
                    }
                    placeholder="Enter Zoraxy password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Zoraxy Data Directory
                </label>
                <Input
                  value={config.zoraxyDataDir}
                  onChange={(e) =>
                    updateConfig("zoraxyDataDir", e.target.value)
                  }
                  placeholder="/opt/zoraxy"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Container className="h-4 w-4" />
                Agent Settings
              </CardTitle>
              <CardDescription>
                Configure how the agent runs on the remote server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Port</label>
                  <Input
                    type="number"
                    value={config.agentPort}
                    onChange={(e) =>
                      updateConfig("agentPort", e.target.value)
                    }
                    placeholder="9191"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zoraxy Mode</label>
                  <Select
                    value={config.zoraxyMode}
                    onValueChange={(v) =>
                      updateConfig("zoraxyMode", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="docker">Docker</SelectItem>
                      <SelectItem value="native">
                        Native (systemd)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.zoraxyMode === "docker" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Docker Container Name
                  </label>
                  <Input
                    value={config.dockerContainer}
                    onChange={(e) =>
                      updateConfig("dockerContainer", e.target.value)
                    }
                    placeholder="zoraxy"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Listen Address</label>
                <Input
                  value={config.listenAddr}
                  onChange={(e) =>
                    updateConfig("listenAddr", e.target.value)
                  }
                  placeholder="0.0.0.0"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Use 0.0.0.0 to listen on all interfaces, or 127.0.0.1 for
                  localhost only.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && generatedScript && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4" />
                  Install Command
                </CardTitle>
                <CardDescription>
                  SSH into your remote server and run this command as root.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-emerald-400 dark:bg-zinc-900">
                    <code>{generatedScript.multiLine}</code>
                  </pre>
                  <div className="absolute right-2 top-2">
                    <CopyButton text={generatedScript.oneLiner} />
                  </div>
                </div>

                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                  <p className="font-medium">What this does:</p>
                  <ol className="mt-1 list-inside list-decimal space-y-0.5">
                    <li>Downloads the latest agent binary from GitHub</li>
                    <li>
                      Writes agent.json with your configuration
                    </li>
                    <li>Installs a systemd service</li>
                    <li>Starts the agent automatically</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <p>After the agent is installed and running:</p>
                  <ol className="list-inside list-decimal space-y-1.5 text-zinc-600 dark:text-zinc-400">
                    <li>
                      Ensure port{" "}
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                        {config.agentPort}
                      </code>{" "}
                      is open in your firewall
                    </li>
                    <li>
                      Go to{" "}
                      <a
                        href="/nodes/new"
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Add Node
                      </a>{" "}
                      and select &quot;Agent&quot; connection mode
                    </li>
                    <li>
                      Enter the server IP, agent port{" "}
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                        {config.agentPort}
                      </code>
                      , and the API key above
                    </li>
                    <li>Test the connection to verify everything works</li>
                  </ol>
                </div>

                <div className="flex gap-2 pt-2">
                  <a href="/nodes/new">
                    <Button>
                      <ExternalLink className="h-4 w-4" />
                      Add Node Now
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      setGeneratedScript(null);
                      setConfig((c) => ({
                        ...c,
                        apiKey: generateApiKey(),
                      }));
                    }}
                  >
                    Generate Another
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Configuration Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      API Key
                    </dt>
                    <dd className="max-w-[300px] truncate font-mono text-xs">
                      {config.apiKey}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Agent Port
                    </dt>
                    <dd className="font-mono">{config.agentPort}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Zoraxy Host
                    </dt>
                    <dd className="font-mono">{config.zoraxyHost}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Zoraxy Port
                    </dt>
                    <dd className="font-mono">{config.zoraxyPort}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Zoraxy User
                    </dt>
                    <dd className="font-mono">{config.zoraxyUser}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Mode</dt>
                    <dd className="font-mono">
                      {config.zoraxyMode === "docker"
                        ? `Docker (${config.dockerContainer})`
                        : "Native (systemd)"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        )}

        {step < 4 && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(s - 1, 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || generating}
            >
              {step === 3 ? (
                generating ? (
                  "Generating..."
                ) : (
                  <>
                    Generate Command
                    <Terminal className="h-4 w-4" />
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

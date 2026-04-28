"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Send,
  Bot,
  Bell,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/app-shell";
import { useApi } from "@/hooks/use-api";

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyNodeDown: boolean;
  notifyNodeUp: boolean;
  notifyCertExpiry: boolean;
  notifyAuditEvents: boolean;
  certExpiryDays: number;
  authorizedUsers: string[];
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: "",
  chatId: "",
  enabled: false,
  notifyNodeDown: true,
  notifyNodeUp: true,
  notifyCertExpiry: true,
  notifyAuditEvents: false,
  certExpiryDays: 14,
  authorizedUsers: [],
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-md-primary" : "bg-md-outline"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-md-on-surface">{label}</p>
        <p className="text-xs text-md-on-surface-variant">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function TelegramSettingsPage() {
  const api = useApi();
  const [config, setConfig] = useState<TelegramConfig>(DEFAULT_CONFIG);
  const [rawToken, setRawToken] = useState("");
  const [authorizedUsersText, setAuthorizedUsersText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [testStatus, setTestStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.get<TelegramConfig>("/api/v1/telegram/config");
      setConfig(data);
      setAuthorizedUsersText(data.authorizedUsers?.join(", ") || "");
      setRawToken("");
    } catch {
      // Config doesn't exist yet, use defaults
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);

    try {
      const payload: Partial<TelegramConfig> = {
        chatId: config.chatId,
        enabled: config.enabled,
        notifyNodeDown: config.notifyNodeDown,
        notifyNodeUp: config.notifyNodeUp,
        notifyCertExpiry: config.notifyCertExpiry,
        notifyAuditEvents: config.notifyAuditEvents,
        certExpiryDays: config.certExpiryDays,
        authorizedUsers: authorizedUsersText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      // Only send token if user typed a new one
      if (rawToken) {
        payload.botToken = rawToken;
      }

      const data = await api.put<TelegramConfig>(
        "/api/v1/telegram/config",
        payload
      );
      setConfig(data);
      setRawToken("");
      setAuthorizedUsersText(data.authorizedUsers?.join(", ") || "");
      setStatus({ type: "success", message: "Settings saved successfully" });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestStatus(null);

    const token = rawToken || config.botToken;
    if (!token || token.includes("...")) {
      setTestStatus({
        type: "error",
        message: "Enter a bot token first (the saved token is masked)",
      });
      setTesting(false);
      return;
    }

    if (!config.chatId) {
      setTestStatus({ type: "error", message: "Enter a Chat ID first" });
      setTesting(false);
      return;
    }

    try {
      const result = await api.post<{ success: boolean; botName: string }>(
        "/api/v1/telegram/test",
        { botToken: token, chatId: config.chatId }
      );
      setTestStatus({
        type: "success",
        message: `Connected to @${result.botName} — check your Telegram!`,
      });
    } catch (err) {
      setTestStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-md-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Telegram Bot
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Configure Telegram bot for notifications and remote monitoring
            </p>
          </div>
          <Badge
            variant={config.enabled ? "default" : "secondary"}
            className={
              config.enabled
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : ""
            }
          >
            {config.enabled ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Bot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Bot Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-md-outline-variant bg-md-surface-container-low p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 shrink-0 text-md-primary mt-0.5" />
                <div className="text-xs text-md-on-surface-variant space-y-1">
                  <p>
                    1. Message{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-md-primary hover:underline"
                    >
                      @BotFather
                    </a>{" "}
                    on Telegram and create a new bot
                  </p>
                  <p>2. Copy the bot token and paste it below</p>
                  <p>
                    3. Start a chat with your bot, then use the{" "}
                    <code className="rounded bg-md-surface-container px-1 font-mono">
                      /chatid
                    </code>{" "}
                    command to get your Chat ID
                  </p>
                </div>
              </div>
            </div>

            <ToggleRow
              label="Enable Telegram Bot"
              description="Turn on/off all Telegram notifications and commands"
              checked={config.enabled}
              onChange={(v) => setConfig({ ...config, enabled: v })}
            />

            <div>
              <label className="text-sm font-medium">Bot Token</label>
              <Input
                className="mt-1 font-mono text-sm"
                type="password"
                placeholder={
                  config.botToken
                    ? config.botToken
                    : "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                }
                value={rawToken}
                onChange={(e) => setRawToken(e.target.value)}
              />
              <p className="mt-1 text-xs text-md-on-surface-variant">
                {config.botToken
                  ? `Current token: ${config.botToken}`
                  : "Get this from @BotFather on Telegram"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Chat ID</label>
              <Input
                className="mt-1 font-mono text-sm"
                placeholder="-1001234567890"
                value={config.chatId}
                onChange={(e) =>
                  setConfig({ ...config, chatId: e.target.value })
                }
              />
              <p className="mt-1 text-xs text-md-on-surface-variant">
                Your personal chat ID or group chat ID. Use /chatid command in
                the bot to find it.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleTest} disabled={testing} variant="outline">
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            </div>

            {testStatus && (
              <div
                className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  testStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                }`}
              >
                {testStatus.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                {testStatus.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ToggleRow
              label="Node Down Alerts"
              description="Get notified when a node goes offline or becomes degraded"
              checked={config.notifyNodeDown}
              onChange={(v) => setConfig({ ...config, notifyNodeDown: v })}
            />
            <ToggleRow
              label="Node Recovery Alerts"
              description="Get notified when a node comes back online"
              checked={config.notifyNodeUp}
              onChange={(v) => setConfig({ ...config, notifyNodeUp: v })}
            />
            <ToggleRow
              label="Certificate Expiry Warnings"
              description="Get notified when SSL certificates are about to expire"
              checked={config.notifyCertExpiry}
              onChange={(v) => setConfig({ ...config, notifyCertExpiry: v })}
            />

            {config.notifyCertExpiry && (
              <div className="pl-0 pt-1 pb-2">
                <label className="text-sm font-medium">
                  Warning threshold (days)
                </label>
                <Input
                  className="mt-1 w-24 font-mono text-sm"
                  type="number"
                  min={1}
                  max={90}
                  value={config.certExpiryDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      certExpiryDays: parseInt(e.target.value) || 14,
                    })
                  }
                />
                <p className="mt-1 text-xs text-md-on-surface-variant">
                  Alert when certificates expire within this many days
                </p>
              </div>
            )}

            <ToggleRow
              label="Audit Event Notifications"
              description="Forward audit log events (node changes, proxy updates, etc.)"
              checked={config.notifyAuditEvents}
              onChange={(v) => setConfig({ ...config, notifyAuditEvents: v })}
            />
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Authorized User IDs
              </label>
              <Input
                className="mt-1 font-mono text-sm"
                placeholder="123456789, 987654321"
                value={authorizedUsersText}
                onChange={(e) => setAuthorizedUsersText(e.target.value)}
              />
              <p className="mt-1 text-xs text-md-on-surface-variant">
                Comma-separated Telegram user IDs allowed to send commands. Leave
                empty to allow anyone who has the bot link.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Available Commands Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Available Bot Commands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {[
                { cmd: "/status", desc: "System overview with node counts" },
                { cmd: "/nodes", desc: "List all nodes with status" },
                { cmd: "/node <id>", desc: "Detailed node health info" },
                { cmd: "/proxies <id>", desc: "List proxy rules for a node" },
                { cmd: "/certs <id>", desc: "List certificates for a node" },
                { cmd: "/audit", desc: "Recent audit log entries" },
                { cmd: "/chatid", desc: "Show your chat ID" },
                { cmd: "/help", desc: "Show all commands" },
              ].map((item) => (
                <div key={item.cmd} className="flex gap-3">
                  <code className="shrink-0 rounded bg-md-surface-container px-1.5 py-0.5 font-mono text-xs text-md-primary">
                    {item.cmd}
                  </code>
                  <span className="text-md-on-surface-variant text-xs pt-0.5">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </Button>

          {status && (
            <p
              className={`text-sm ${
                status.type === "success"
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

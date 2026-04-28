import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { listNodes, getNodeHealth } from "./node.service";
import { listProxyRules } from "./proxy.service";
import { listCerts } from "./cert.service";
import { getAuditLogs } from "./audit.service";

// ─── Telegram Bot API types ───────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyNodeDown: boolean;
  notifyNodeUp: boolean;
  notifyCertExpiry: boolean;
  notifyAuditEvents: boolean;
  certExpiryDays: number;
  authorizedUsers: string[]; // Telegram user IDs allowed to send commands
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

const SETTINGS_KEY = "telegram_config";

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (rows.length === 0) return { ...DEFAULT_CONFIG };

  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(rows[0].value) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveTelegramConfig(
  config: Partial<TelegramConfig>
): Promise<TelegramConfig> {
  const current = await getTelegramConfig();
  const merged = { ...current, ...config };
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(settings).values({
      key: SETTINGS_KEY,
      value: JSON.stringify(merged),
      updatedAt: now,
    });
  } else {
    await db
      .update(settings)
      .set({ value: JSON.stringify(merged), updatedAt: now })
      .where(eq(settings.key, SETTINGS_KEY));
  }

  return merged;
}

// ─── Telegram Bot API calls ──────────────────────────────────────────────────

async function telegramApi<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(
      `Telegram API error: ${data.description || "Unknown error"}`
    );
  }
  return data.result as T;
}

export async function verifyBotToken(
  token: string
): Promise<TelegramBotInfo> {
  return telegramApi<TelegramBotInfo>(token, "getMe");
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML"
): Promise<void> {
  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function sendNotification(message: string): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken || !config.chatId) return;

  try {
    await sendMessage(config.botToken, config.chatId, message);
  } catch (err) {
    console.error("[Telegram] Failed to send notification:", err);
  }
}

export async function notifyNodeStatusChange(
  nodeName: string,
  nodeId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled) return;

  const isDown = newStatus === "offline" || newStatus === "degraded";
  const isUp = newStatus === "online";

  if (isDown && !config.notifyNodeDown) return;
  if (isUp && !config.notifyNodeUp) return;
  if (!isDown && !isUp) return;

  const emoji = isUp ? "\u2705" : "\ud83d\udea8";
  const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

  const message = [
    `${emoji} <b>Node Status Change</b>`,
    ``,
    `<b>Node:</b> ${escapeHtml(nodeName)}`,
    `<b>Status:</b> ${escapeHtml(oldStatus)} \u2192 <b>${escapeHtml(statusLabel)}</b>`,
    `<b>Node ID:</b> <code>${escapeHtml(nodeId)}</code>`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");

  await sendNotification(message);
}

export async function notifyCertExpiry(
  nodeName: string,
  domain: string,
  daysLeft: number
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.notifyCertExpiry) return;

  const emoji = daysLeft <= 3 ? "\ud83d\udea8" : "\u26a0\ufe0f";

  const message = [
    `${emoji} <b>Certificate Expiry Warning</b>`,
    ``,
    `<b>Domain:</b> ${escapeHtml(domain)}`,
    `<b>Node:</b> ${escapeHtml(nodeName)}`,
    `<b>Expires in:</b> <b>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</b>`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");

  await sendNotification(message);
}

export async function notifyAuditEvent(
  action: string,
  entityType: string,
  entityId: string | null,
  result: string,
  details?: Record<string, unknown> | null
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.notifyAuditEvents) return;

  const emoji = result === "success" ? "\u2139\ufe0f" : "\u274c";

  const message = [
    `${emoji} <b>Audit Event</b>`,
    ``,
    `<b>Action:</b> ${escapeHtml(action)}`,
    `<b>Type:</b> ${escapeHtml(entityType)}`,
    entityId ? `<b>Entity:</b> <code>${escapeHtml(entityId)}</code>` : null,
    `<b>Result:</b> ${escapeHtml(result)}`,
    details
      ? `<b>Details:</b> <code>${escapeHtml(JSON.stringify(details).slice(0, 200))}</code>`
      : null,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendNotification(message);
}

// ─── Command handler (webhook) ────────────────────────────────────────────────

export async function handleWebhookUpdate(
  update: TelegramUpdate
): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) return;

  const userId = message.from?.id?.toString() || "";
  const chatId = message.chat.id.toString();

  // Check authorization
  if (
    config.authorizedUsers.length > 0 &&
    !config.authorizedUsers.includes(userId)
  ) {
    await sendMessage(
      config.botToken,
      chatId,
      "\u26d4 You are not authorized to use this bot."
    );
    return;
  }

  const text = message.text.trim();
  const [command, ...args] = text.split(/\s+/);

  try {
    switch (command.toLowerCase().replace(/@\w+$/, "")) {
      case "/start":
      case "/help":
        await handleHelp(config.botToken, chatId);
        break;
      case "/status":
        await handleStatus(config.botToken, chatId);
        break;
      case "/nodes":
        await handleNodes(config.botToken, chatId);
        break;
      case "/node":
        await handleNodeDetail(config.botToken, chatId, args[0]);
        break;
      case "/proxies":
        await handleProxies(config.botToken, chatId, args[0]);
        break;
      case "/certs":
        await handleCerts(config.botToken, chatId, args[0]);
        break;
      case "/audit":
        await handleAudit(config.botToken, chatId);
        break;
      case "/chatid":
        await sendMessage(
          config.botToken,
          chatId,
          `\ud83d\udcac Your Chat ID: <code>${chatId}</code>`
        );
        break;
      default:
        await sendMessage(
          config.botToken,
          chatId,
          "\u2753 Unknown command. Use /help to see available commands."
        );
    }
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "An error occurred";
    await sendMessage(
      config.botToken,
      chatId,
      `\u274c <b>Error:</b> ${escapeHtml(errMsg)}`
    );
  }
}

// ─── Command implementations ──────────────────────────────────────────────────

async function handleHelp(token: string, chatId: string): Promise<void> {
  const message = [
    `\ud83e\udd16 <b>ZoraxyHub Bot</b>`,
    ``,
    `<b>Available Commands:</b>`,
    ``,
    `/status \u2014 System overview`,
    `/nodes \u2014 List all nodes`,
    `/node &lt;id&gt; \u2014 Node details & health`,
    `/proxies &lt;node_id&gt; \u2014 List proxy rules`,
    `/certs &lt;node_id&gt; \u2014 List certificates`,
    `/audit \u2014 Recent audit events`,
    `/chatid \u2014 Show your chat ID`,
    `/help \u2014 Show this help`,
  ].join("\n");

  await sendMessage(token, chatId, message);
}

async function handleStatus(
  token: string,
  chatId: string
): Promise<void> {
  const allNodes = await listNodes();
  const online = allNodes.filter((n) => n.status === "online").length;
  const offline = allNodes.filter((n) => n.status === "offline").length;
  const degraded = allNodes.filter((n) => n.status === "degraded").length;
  const unknown = allNodes.filter((n) => n.status === "unknown").length;

  const statusEmoji = offline > 0 ? "\ud83d\udfe1" : "\ud83d\udfe2";

  const message = [
    `${statusEmoji} <b>ZoraxyHub Status</b>`,
    ``,
    `\ud83d\udda5 <b>Nodes:</b> ${allNodes.length} total`,
    `  \u2705 Online: ${online}`,
    offline > 0 ? `  \u274c Offline: ${offline}` : null,
    degraded > 0 ? `  \u26a0\ufe0f Degraded: ${degraded}` : null,
    unknown > 0 ? `  \u2753 Unknown: ${unknown}` : null,
    ``,
    `\ud83d\udd52 <b>Checked:</b> ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMessage(token, chatId, message);
}

async function handleNodes(
  token: string,
  chatId: string
): Promise<void> {
  const allNodes = await listNodes();

  if (allNodes.length === 0) {
    await sendMessage(token, chatId, "\ud83d\udcad No nodes configured.");
    return;
  }

  const lines = allNodes.map((node) => {
    const emoji =
      node.status === "online"
        ? "\ud83d\udfe2"
        : node.status === "offline"
          ? "\ud83d\udd34"
          : node.status === "degraded"
            ? "\ud83d\udfe1"
            : "\u26aa";
    return `${emoji} <b>${escapeHtml(node.name)}</b>\n   <code>${escapeHtml(node.id)}</code>\n   ${escapeHtml(node.host)}:${node.port} (${node.connectionMode})`;
  });

  const message = [
    `\ud83d\udda5 <b>Nodes (${allNodes.length})</b>`,
    ``,
    ...lines,
  ].join("\n");

  await sendMessage(token, chatId, message);
}

async function handleNodeDetail(
  token: string,
  chatId: string,
  nodeId?: string
): Promise<void> {
  if (!nodeId) {
    await sendMessage(
      token,
      chatId,
      "\u26a0\ufe0f Usage: /node &lt;node_id&gt;"
    );
    return;
  }

  const health = await getNodeHealth(nodeId);

  const statusEmoji =
    health.status === "online"
      ? "\ud83d\udfe2"
      : health.status === "offline"
        ? "\ud83d\udd34"
        : "\ud83d\udfe1";

  const lines = [
    `${statusEmoji} <b>Node Health</b>`,
    ``,
    `<b>ID:</b> <code>${escapeHtml(health.nodeId)}</code>`,
    `<b>Status:</b> ${health.status}`,
    health.zoraxyVersion
      ? `<b>Zoraxy:</b> v${escapeHtml(health.zoraxyVersion)}`
      : null,
    health.uptime !== null
      ? `<b>Uptime:</b> ${formatUptime(health.uptime)}`
      : null,
    health.cpu !== null ? `<b>CPU:</b> ${health.cpu.toFixed(1)}%` : null,
    health.memory !== null
      ? `<b>Memory:</b> ${health.memory.toFixed(1)}%`
      : null,
    health.proxyCount !== null
      ? `<b>Proxy Rules:</b> ${health.proxyCount}`
      : null,
    health.certCount !== null
      ? `<b>Certificates:</b> ${health.certCount}`
      : null,
    ``,
    `\ud83d\udd52 Checked: ${health.checkedAt}`,
  ];

  await sendMessage(
    token,
    chatId,
    lines.filter(Boolean).join("\n")
  );
}

async function handleProxies(
  token: string,
  chatId: string,
  nodeId?: string
): Promise<void> {
  if (!nodeId) {
    await sendMessage(
      token,
      chatId,
      "\u26a0\ufe0f Usage: /proxies &lt;node_id&gt;"
    );
    return;
  }

  const rules = await listProxyRules(nodeId);

  if (rules.length === 0) {
    await sendMessage(token, chatId, "\ud83d\udcad No proxy rules found.");
    return;
  }

  const lines = rules.slice(0, 20).map((rule) => {
    const enabled = rule.Disabled !== true ? "\u2705" : "\u274c";
    const domain = rule.RootOrMatchingDomain || "unknown";
    return `${enabled} <code>${escapeHtml(domain)}</code>`;
  });

  const message = [
    `\ud83c\udf10 <b>Proxy Rules (${rules.length})</b>`,
    ``,
    ...lines,
    rules.length > 20 ? `\n... and ${rules.length - 20} more` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMessage(token, chatId, message);
}

async function handleCerts(
  token: string,
  chatId: string,
  nodeId?: string
): Promise<void> {
  if (!nodeId) {
    await sendMessage(
      token,
      chatId,
      "\u26a0\ufe0f Usage: /certs &lt;node_id&gt;"
    );
    return;
  }

  const certs = await listCerts(nodeId);

  if (certs.length === 0) {
    await sendMessage(token, chatId, "\ud83d\udcad No certificates found.");
    return;
  }

  const lines = certs.slice(0, 20).map((cert) => {
    const domain = cert.Domain || "unknown";
    const expiry = cert.ExpireDate
      ? new Date(cert.ExpireDate).toLocaleDateString()
      : "N/A";
    return `\ud83d\udd10 <code>${escapeHtml(domain)}</code> \u2014 expires ${expiry}`;
  });

  const message = [
    `\ud83d\udee1 <b>Certificates (${certs.length})</b>`,
    ``,
    ...lines,
    certs.length > 20 ? `\n... and ${certs.length - 20} more` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMessage(token, chatId, message);
}

async function handleAudit(
  token: string,
  chatId: string
): Promise<void> {
  const { entries } = await getAuditLogs({ page: 1, pageSize: 10 });

  if (entries.length === 0) {
    await sendMessage(token, chatId, "\ud83d\udcad No audit entries found.");
    return;
  }

  const lines = entries.map((entry) => {
    const emoji = entry.result === "success" ? "\u2705" : "\u274c";
    const time = new Date(entry.createdAt).toLocaleString();
    return `${emoji} <b>${escapeHtml(entry.action)}</b> (${escapeHtml(entry.entityType)})\n   ${time}`;
  });

  const message = [
    `\ud83d\udcdc <b>Recent Audit Events</b>`,
    ``,
    ...lines,
  ].join("\n");

  await sendMessage(token, chatId, message);
}

// ─── Webhook management ──────────────────────────────────────────────────────

export async function setWebhook(
  token: string,
  webhookUrl: string
): Promise<void> {
  await telegramApi(token, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
  });
}

export async function deleteWebhook(token: string): Promise<void> {
  await telegramApi(token, "deleteWebhook");
}

export async function getWebhookInfo(
  token: string
): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number }> {
  return telegramApi(token, "getWebhookInfo");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testTelegramConnection(
  token: string,
  chatId: string
): Promise<{ success: boolean; botName: string }> {
  const bot = await verifyBotToken(token);

  await sendMessage(
    token,
    chatId,
    [
      `\u2705 <b>ZoraxyHub Connected!</b>`,
      ``,
      `Bot <b>@${escapeHtml(bot.username)}</b> is now linked to this chat.`,
      `Use /help to see available commands.`,
    ].join("\n")
  );

  return { success: true, botName: bot.username };
}

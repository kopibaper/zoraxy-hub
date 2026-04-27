import { timingSafeEqual } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as os from "node:os";
import { dirname, join, resolve } from "node:path";

declare const Bun: any;

interface AgentConfig {
  apiKey: string;
  listenAddr: string;
  listenPort: number;
  tls?: {
    cert?: string;
    key?: string;
  };
  zoraxy: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  zoraxyDataDir: string;
  docker: {
    enabled: boolean;
    containerName: string;
  };
}

const AGENT_VERSION = "2.0.0";
const SESSION_TTL_MS = 10 * 60 * 1000;
const DOCKER_NAME_RE = /^[A-Za-z0-9._-]+$/;
const DOCKER_SINCE_RE = /^[A-Za-z0-9._:-]+$/;

class LocalZoraxyClient {
  private readonly baseUrl: string;
  private readonly username?: string;
  private readonly password?: string;
  private cookie = "";
  private csrfToken = "";
  private sessionExpiresAt = 0;

  constructor(config: AgentConfig) {
    this.baseUrl = `http://${config.zoraxy.host}:${config.zoraxy.port}`;
    this.username = config.zoraxy.username;
    this.password = config.zoraxy.password;
  }

  private async authenticate(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error("Missing ZORAXY_USERNAME or ZORAXY_PASSWORD");
    }

    const pageResponse = await fetch(`${this.baseUrl}/login.html`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!pageResponse.ok) {
      throw new Error(`Cannot reach Zoraxy login page (HTTP ${pageResponse.status})`);
    }

    const setCookieHeader = pageResponse.headers.get("set-cookie");
    if (!setCookieHeader) {
      throw new Error("Zoraxy did not return a CSRF cookie");
    }

    const csrfCookie = setCookieHeader.split(";")[0];
    const html = await pageResponse.text();
    const csrfMatch = html.match(/zoraxy\.csrf\.Token[^>]*content="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error("Cannot extract CSRF token from Zoraxy login page");
    }

    const csrfToken = csrfMatch[1];
    const body = new URLSearchParams({
      username: this.username,
      password: this.password,
    });

    const loginResponse = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
        "X-CSRF-Token": csrfToken,
      },
      body: body.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await loginResponse.text();
    if (loginResponse.status === 403) {
      throw new Error(`Zoraxy CSRF validation failed: ${responseText}`);
    }

    if (responseText.startsWith("{")) {
      let parsed: { error?: unknown } | null = null;
      try {
        parsed = JSON.parse(responseText) as { error?: unknown };
      } catch {
        parsed = null;
      }

      if (parsed?.error) {
        throw new Error(`Zoraxy login rejected: ${String(parsed.error)}`);
      }
    }

    const loginSetCookie = loginResponse.headers.get("set-cookie");
    const sessionCookie = loginSetCookie ? loginSetCookie.split(";")[0] : "";

    this.cookie = sessionCookie ? `${csrfCookie}; ${sessionCookie}` : csrfCookie;
    this.csrfToken = csrfToken;
    this.sessionExpiresAt = Date.now() + SESSION_TTL_MS;
  }

  private async request<T = unknown>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown> | FormData,
    isRetry = false
  ): Promise<T> {
    if (!this.cookie || !this.csrfToken || Date.now() >= this.sessionExpiresAt) {
      await this.authenticate();
    }

    const headers: Record<string, string> = {
      Cookie: this.cookie,
    };

    let requestBody: string | FormData | undefined;
    if (body instanceof FormData) {
      requestBody = body;
    } else if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        params.append(key, String(value));
      }
      requestBody = params.toString();
    }

    if (method !== "GET") {
      headers["X-CSRF-Token"] = this.csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(15000),
    });

    if ((response.status === 401 || response.status === 403) && !isRetry) {
      this.cookie = "";
      this.csrfToken = "";
      this.sessionExpiresAt = 0;
      return this.request(method, path, body, true);
    }

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // plain text response
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as Record<string, unknown>).error)
          : text || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    switch (method) {
      case "proxy.list":
        return this.request("GET", "/api/proxy/list?type=host");
      case "proxy.detail":
        return this.request("POST", "/api/proxy/detail", {
          type: "host",
          rootname: String(params.domain ?? ""),
        });
      case "proxy.add":
        await this.request("POST", "/api/proxy/add", {
          type: String(params.proxyType ?? ""),
          rootname: String(params.rootDomain ?? ""),
          origin: String(params.origin ?? ""),
          tls: String(Boolean(params.requireTLS)),
        });
        return null;
      case "proxy.delete":
        await this.request("POST", "/api/proxy/del", { ep: String(params.domain ?? "") });
        return null;
      case "proxy.toggle":
        await this.request("POST", "/api/proxy/toggle", {
          ep: String(params.domain ?? ""),
          enabled: String(Boolean(params.enabled)),
        });
        return null;
      case "proxy.edit":
        await this.request("POST", "/api/proxy/edit", {
          ep: String(params.domain ?? ""),
          ...((params.updates as Record<string, unknown> | undefined) ?? {}),
        });
        return null;
      case "upstream.list":
        return this.request("POST", "/api/proxy/upstream/list", {
          ep: String(params.domain ?? ""),
        });
      case "upstream.add":
        await this.request("POST", "/api/proxy/upstream/add", {
          ep: String(params.domain ?? ""),
          origin: String(params.origin ?? ""),
          tls: String(Boolean(params.requireTLS)),
          tlsval: String(Boolean(params.skipCertValidation ?? false)),
          weight: String(Number(params.weight ?? 1)),
        });
        return null;
      case "upstream.remove":
        await this.request("POST", "/api/proxy/upstream/remove", {
          ep: String(params.domain ?? ""),
          origin: String(params.origin ?? ""),
        });
        return null;
      case "vdir.add":
        await this.request("POST", "/api/proxy/vdir/add", {
          ep: String(params.rootDomain ?? ""),
          matchingPath: String(params.matchingPath ?? ""),
          domain: String(params.domain ?? ""),
          tls: String(Boolean(params.requireTLS)),
          skipCertValidation: String(Boolean(params.skipCertValidation)),
        });
        return null;
      case "vdir.delete":
        await this.request("POST", "/api/proxy/vdir/del", {
          ep: String(params.rootDomain ?? ""),
          matchingPath: String(params.matchingPath ?? ""),
        });
        return null;
      case "header.add":
        await this.request("POST", "/api/proxy/header/add", {
          ep: String(params.rootDomain ?? ""),
          direction: String(params.direction ?? ""),
          name: String(params.key ?? ""),
          value: String(params.value ?? ""),
          isRemove: String(Boolean(params.isRemove)),
        });
        return null;
      case "header.delete":
        await this.request("POST", "/api/proxy/header/remove", {
          ep: String(params.rootDomain ?? ""),
          direction: String(params.direction ?? ""),
          name: String(params.key ?? ""),
        });
        return null;
      case "alias.set":
        await this.request("POST", "/api/proxy/setAlias", {
          ep: String(params.rootDomain ?? ""),
          alias: Array.isArray(params.aliases)
            ? params.aliases.map((value) => String(value)).join(",")
            : "",
        });
        return null;
      case "cert.list":
        return this.request("GET", "/api/cert/list");
      case "cert.upload": {
        const formData = new FormData();
        formData.append("domain", String(params.domain ?? ""));
        formData.append(
          "cert",
          new Blob([String(params.certPem ?? "")], { type: "application/x-pem-file" }),
          "cert.pem"
        );
        formData.append(
          "key",
          new Blob([String(params.keyPem ?? "")], { type: "application/x-pem-file" }),
          "key.pem"
        );
        await this.request("POST", "/api/cert/upload", formData);
        return null;
      }
      case "cert.delete":
        await this.request("POST", "/api/cert/delete", {
          domain: String(params.domain ?? ""),
        });
        return null;
      case "acme.obtain":
        await this.request("POST", "/api/acme/obtainCert", {
          domains: Array.isArray(params.domains)
            ? params.domains.map((value) => String(value)).join(",")
            : "",
          email: String(params.email ?? ""),
        });
        return null;
      case "access.list":
        return this.request("GET", "/api/access/list");
      case "blacklist.add":
        await this.request("POST", "/api/blacklist/add", {
          id: String(params.ruleId ?? ""),
          ip: String(params.ip ?? ""),
          comment: String(params.comment ?? ""),
        });
        return null;
      case "whitelist.add":
        await this.request("POST", "/api/whitelist/add", {
          id: String(params.ruleId ?? ""),
          ip: String(params.ip ?? ""),
          comment: String(params.comment ?? ""),
        });
        return null;
      case "blacklist.get":
        return this.request("POST", "/api/blacklist/list", {
          id: String(params.ruleId ?? ""),
        });
      case "whitelist.get":
        return this.request("POST", "/api/whitelist/list", {
          id: String(params.ruleId ?? ""),
        });
      case "blacklist.remove":
        await this.request("POST", "/api/blacklist/remove", {
          id: String(params.ruleId ?? ""),
          ip: String(params.ip ?? ""),
        });
        return null;
      case "whitelist.remove":
        await this.request("POST", "/api/whitelist/remove", {
          id: String(params.ruleId ?? ""),
          ip: String(params.ip ?? ""),
        });
        return null;
      case "stream.list":
        return this.request("GET", "/api/streamprox/list");
      case "stream.add":
        await this.request("POST", "/api/streamprox/add", params);
        return null;
      case "stream.remove":
        await this.request("POST", "/api/streamprox/remove", { id: String(params.id ?? "") });
        return null;
      case "stream.start":
        await this.request("POST", "/api/streamprox/start", { id: String(params.id ?? "") });
        return null;
      case "stream.stop":
        await this.request("POST", "/api/streamprox/stop", { id: String(params.id ?? "") });
        return null;
      case "redirect.list":
        return this.request("GET", "/api/redirect/list");
      case "redirect.add":
        await this.request("POST", "/api/redirect/add", {
          redirectUrl: String(params.redirectUrl ?? ""),
          destUrl: String(params.destUrl ?? ""),
          statusCode: String(Number(params.statusCode ?? 302)),
        });
        return null;
      case "redirect.delete":
        await this.request("POST", "/api/redirect/delete", { id: String(params.id ?? "") });
        return null;
      case "redirect.edit":
        await this.request("POST", "/api/redirect/edit", {
          id: String(params.id ?? ""),
          redirectUrl: String(params.redirectUrl ?? ""),
          destUrl: String(params.destUrl ?? ""),
          statusCode: String(Number(params.statusCode ?? 302)),
          forwardChildpath: String(Boolean(params.forwardChildpath)),
        });
        return null;
      case "stats.summary":
        return this.request("GET", "/api/stats/summary");
      case "stats.netstat":
        return this.request("GET", "/api/stats/netstat");
      case "stats.uptime":
        return this.request("GET", "/api/utm/list");
      case "system.info":
        return this.request("GET", "/api/info/x");
      case "config.export":
        return this.request("GET", "/api/conf/export");
      case "acme.autoRenewDomains":
        return this.request("GET", "/api/acme/autoRenew/listDomains");
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  async rawRequest(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(method, path, body);
  }
}

function ok(data: unknown): Response {
  return Response.json({ ok: true, data });
}

function err(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function parseInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return fallback;
}

async function loadFileConfig(): Promise<Partial<AgentConfig>> {
  const configPath = join(process.cwd(), "agent.json");
  if (!existsSync(configPath)) {
    return {};
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const tls = (parsed.tls ?? {}) as Record<string, unknown>;
  const zoraxy = (parsed.zoraxy ?? {}) as Record<string, unknown>;
  const docker = (parsed.docker ?? {}) as Record<string, unknown>;

  return {
    apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
    listenAddr: typeof parsed.listenAddr === "string" ? parsed.listenAddr : undefined,
    listenPort: parseInteger(parsed.listenPort, 9191),
    tls: {
      cert: typeof tls.cert === "string" ? tls.cert : undefined,
      key: typeof tls.key === "string" ? tls.key : undefined,
    },
    zoraxy: {
      host: typeof zoraxy.host === "string" ? zoraxy.host : "localhost",
      port: parseInteger(zoraxy.port, 8000),
      username: typeof zoraxy.username === "string" ? zoraxy.username : undefined,
      password: typeof zoraxy.password === "string" ? zoraxy.password : undefined,
    },
    zoraxyDataDir: typeof parsed.zoraxyDataDir === "string" ? parsed.zoraxyDataDir : undefined,
    docker: {
      enabled: parseBoolean(docker.enabled, true),
      containerName: typeof docker.containerName === "string" ? docker.containerName : "zoraxy",
    },
  };
}

async function loadConfig(): Promise<AgentConfig> {
  const fileConfig = await loadFileConfig();

  const apiKey = process.env.AGENT_API_KEY || fileConfig.apiKey || "";
  const listenAddr = fileConfig.listenAddr || "0.0.0.0";
  const listenPort = Number(process.env.AGENT_PORT || fileConfig.listenPort || 9191);
  const zoraxyHost = process.env.ZORAXY_HOST || fileConfig.zoraxy?.host || "localhost";
  const zoraxyPort = Number(process.env.ZORAXY_PORT || fileConfig.zoraxy?.port || 8000);
  const zoraxyUsername = process.env.ZORAXY_USERNAME || fileConfig.zoraxy?.username;
  const zoraxyPassword = process.env.ZORAXY_PASSWORD || fileConfig.zoraxy?.password;
  const zoraxyDataDir = process.env.ZORAXY_DATA_DIR || fileConfig.zoraxyDataDir || "/opt/zoraxy";
  const dockerContainer =
    process.env.DOCKER_CONTAINER || fileConfig.docker?.containerName || "zoraxy";
  const dockerEnabled = fileConfig.docker?.enabled ?? true;

  if (!apiKey) {
    throw new Error("Missing AGENT_API_KEY (or agent.json apiKey)");
  }

  if (!Number.isFinite(listenPort)) {
    throw new Error("Invalid AGENT_PORT");
  }

  if (!Number.isFinite(zoraxyPort)) {
    throw new Error("Invalid ZORAXY_PORT");
  }

  if (!DOCKER_NAME_RE.test(dockerContainer)) {
    throw new Error("Invalid docker container name");
  }

  const cert = fileConfig.tls?.cert;
  const key = fileConfig.tls?.key;

  return {
    apiKey,
    listenAddr,
    listenPort,
    tls: cert && key ? { cert, key } : undefined,
    zoraxy: {
      host: zoraxyHost,
      port: zoraxyPort,
      username: zoraxyUsername,
      password: zoraxyPassword,
    },
    zoraxyDataDir,
    docker: {
      enabled: dockerEnabled,
      containerName: dockerContainer,
    },
  };
}

function logRequest(req: Request): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${new URL(req.url).pathname}`);
}

function authValid(authHeader: string | null, apiKey: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  const a = Buffer.from(token);
  const b = Buffer.from(apiKey);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function runCommand(command: string): string {
  try {
    const output = execSync(command, {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command execution failed";
    throw new Error(message);
  }
}

function parseDiskInfo(): { total: number; free: number } {
  try {
    const output = runCommand("df -k /");
    const lines = output.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      throw new Error("Unexpected df output");
    }
    const parts = lines[1].trim().split(/\s+/);
    const total = Number(parts[1]) * 1024;
    const free = Number(parts[3]) * 1024;
    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      throw new Error("Failed to parse disk information");
    }
    return { total, free };
  } catch {
    return { total: 0, free: 0 };
  }
}

async function sampleCpuUsagePercent(): Promise<number> {
  const first = os.cpus();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  const second = os.cpus();

  let idle = 0;
  let total = 0;
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i].times;
    const b = second[i].times;
    const idleDiff = b.idle - a.idle;
    const totalDiff =
      (b.user - a.user) +
      (b.nice - a.nice) +
      (b.sys - a.sys) +
      (b.idle - a.idle) +
      (b.irq - a.irq);
    idle += idleDiff;
    total += totalDiff;
  }

  if (total <= 0) {
    return 0;
  }

  return Number((((total - idle) / total) * 100).toFixed(2));
}

function ensureSafeDockerContainer(name: string): string {
  if (!DOCKER_NAME_RE.test(name)) {
    throw new Error("Invalid docker container name");
  }
  return name;
}

function resolveSandboxPath(root: string, relativePath = ""): string {
  const sandboxRoot = resolve(root);
  const target = resolve(sandboxRoot, relativePath);
  if (target !== sandboxRoot && !target.startsWith(`${sandboxRoot}/`) && !target.startsWith(`${sandboxRoot}\\`)) {
    throw new Error("Path escapes sandbox root");
  }
  return target;
}

function parseJsonBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid JSON body");
  }
  return value as Record<string, unknown>;
}

function requireDockerEnabled(config: AgentConfig): void {
  if (!config.docker.enabled) {
    throw new Error("Docker integration is disabled");
  }
}

function requireServiceMode(config: AgentConfig): void {
  if (config.docker.enabled) {
    throw new Error("Service controls are only available when docker.enabled is false");
  }
}

async function start(): Promise<void> {
  const config = await loadConfig();
  const localClient = new LocalZoraxyClient(config);

  const server = Bun.serve({
    hostname: config.listenAddr,
    port: config.listenPort,
    ...(config.tls
      ? {
          tls: {
            cert: Bun.file(config.tls.cert!),
            key: Bun.file(config.tls.key!),
          },
        }
      : {}),
    fetch: async (req: Request): Promise<Response> => {
      logRequest(req);
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/api/v1/ping") {
        return ok({
          agent: "zoraxy-agent",
          version: AGENT_VERSION,
          timestamp: Date.now(),
        });
      }

      if (!authValid(req.headers.get("authorization"), config.apiKey)) {
        return err("Unauthorized", 401);
      }

      try {
        if (req.method === "GET" && pathname === "/api/v1/info") {
          const memoryTotal = os.totalmem();
          const memoryFree = os.freemem();
          const disk = parseDiskInfo();
          const cpuUsagePercent = await sampleCpuUsagePercent();

          return ok({
            hostname: os.hostname(),
            platform: os.platform(),
            release: os.release(),
            cpuCount: os.cpus().length,
            cpuUsagePercent,
            memoryTotal,
            memoryFree,
            memoryUsedPercent: Number((((memoryTotal - memoryFree) / memoryTotal) * 100).toFixed(2)),
            diskTotal: disk.total,
            diskFree: disk.free,
            uptimeSeconds: Math.floor(os.uptime()),
            agentVersion: AGENT_VERSION,
          });
        }

        if (req.method === "POST" && pathname === "/api/v1/rpc") {
          const body = parseJsonBody(await req.json());
          const method = String(body.method ?? "");
          const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
          if (!method) {
            throw new Error("Missing method");
          }
          const result = await localClient.call(method, params);
          return ok(result);
        }

        if (req.method === "POST" && pathname === "/api/v1/zoraxy") {
          const body = parseJsonBody(await req.json());
          const method = String(body.method ?? "").toUpperCase();
          const apiPath = String(body.path ?? "");
          const requestBody = body.body && typeof body.body === "object" ? (body.body as Record<string, unknown>) : undefined;

          if (method !== "GET" && method !== "POST") {
            throw new Error("method must be GET or POST");
          }
          if (!apiPath.startsWith("/")) {
            throw new Error("path must start with /");
          }

          const result = await localClient.rawRequest(method, apiPath, requestBody);
          return ok(result);
        }

        if (req.method === "GET" && pathname === "/api/v1/docker/status") {
          requireDockerEnabled(config);
          const name = ensureSafeDockerContainer(config.docker.containerName);
          const output = runCommand(`docker inspect ${name} --format "{{json .}}"`);
          const data = JSON.parse(output) as {
            Id?: string;
            Config?: { Image?: string };
            State?: { Status?: string; StartedAt?: string };
          };
          return ok({
            status: data.State?.Status ?? "unknown",
            id: data.Id ?? "",
            image: data.Config?.Image ?? "",
            startedAt: data.State?.StartedAt ?? "",
          });
        }

        if (req.method === "POST" && pathname === "/api/v1/docker/restart") {
          requireDockerEnabled(config);
          const name = ensureSafeDockerContainer(config.docker.containerName);
          runCommand(`docker restart ${name}`);
          return ok({ restarted: true, container: name });
        }

        if (req.method === "POST" && pathname === "/api/v1/docker/stop") {
          requireDockerEnabled(config);
          const name = ensureSafeDockerContainer(config.docker.containerName);
          runCommand(`docker stop ${name}`);
          return ok({ stopped: true, container: name });
        }

        if (req.method === "POST" && pathname === "/api/v1/docker/start") {
          requireDockerEnabled(config);
          const name = ensureSafeDockerContainer(config.docker.containerName);
          runCommand(`docker start ${name}`);
          return ok({ started: true, container: name });
        }

        if (req.method === "GET" && pathname === "/api/v1/docker/logs") {
          requireDockerEnabled(config);
          const name = ensureSafeDockerContainer(config.docker.containerName);
          const tail = Math.max(1, Math.min(5000, Number(url.searchParams.get("tail") ?? "100")));
          const since = url.searchParams.get("since");
          if (since && !DOCKER_SINCE_RE.test(since)) {
            throw new Error("Invalid since parameter");
          }
          const sincePart = since ? ` --since ${since}` : "";
          const logs = runCommand(`docker logs --tail ${tail}${sincePart} ${name}`);
          return ok({ logs });
        }

        if (req.method === "POST" && pathname === "/api/v1/service/restart") {
          requireServiceMode(config);
          runCommand("systemctl restart zoraxy");
          return ok({ restarted: true, service: "zoraxy" });
        }

        if (req.method === "POST" && pathname === "/api/v1/service/stop") {
          requireServiceMode(config);
          runCommand("systemctl stop zoraxy");
          return ok({ stopped: true, service: "zoraxy" });
        }

        if (req.method === "POST" && pathname === "/api/v1/service/start") {
          requireServiceMode(config);
          runCommand("systemctl start zoraxy");
          return ok({ started: true, service: "zoraxy" });
        }

        if (req.method === "GET" && pathname === "/api/v1/service/status") {
          requireServiceMode(config);
          const pidRaw = runCommand("systemctl show -p MainPID --value zoraxy");
          const active = runCommand("systemctl is-active zoraxy") === "active";
          const pid = Number(pidRaw);
          let uptimeSeconds = 0;
          if (Number.isFinite(pid) && pid > 0) {
            const etimes = runCommand(`ps -p ${pid} -o etimes=`);
            uptimeSeconds = Number(etimes.trim()) || 0;
          }

          return ok({
            running: active && pid > 0,
            pid: pid > 0 ? pid : null,
            uptimeSeconds,
          });
        }

        if (req.method === "GET" && pathname === "/api/v1/files") {
          const relPath = url.searchParams.get("path") ?? "";
          const target = resolveSandboxPath(config.zoraxyDataDir, relPath);
          const entries = readdirSync(target, { withFileTypes: true }).map((entry) => {
            const fullPath = resolve(target, entry.name);
            const stats = statSync(fullPath);
            return {
              name: entry.name,
              isDirectory: entry.isDirectory(),
              size: stats.size,
              modified: stats.mtimeMs,
            };
          });
          return ok(entries);
        }

        if (req.method === "GET" && pathname === "/api/v1/files/read") {
          const relPath = url.searchParams.get("path") ?? "";
          if (!relPath) {
            throw new Error("Missing path query parameter");
          }
          const target = resolveSandboxPath(config.zoraxyDataDir, relPath);
          const content = readFileSync(target, "utf8");
          return ok({ path: relPath, content });
        }

        if (req.method === "PUT" && pathname === "/api/v1/files/write") {
          const body = parseJsonBody(await req.json());
          const relPath = String(body.path ?? "");
          const content = String(body.content ?? "");
          if (!relPath) {
            throw new Error("Missing path");
          }
          const target = resolveSandboxPath(config.zoraxyDataDir, relPath);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, content, "utf8");
          return ok({ written: true, path: relPath, bytes: Buffer.byteLength(content, "utf8") });
        }

        if (req.method === "DELETE" && pathname === "/api/v1/files/delete") {
          const body = parseJsonBody(await req.json());
          const relPath = String(body.path ?? "");
          if (!relPath) {
            throw new Error("Missing path");
          }
          const target = resolveSandboxPath(config.zoraxyDataDir, relPath);
          const st = statSync(target);
          if (st.isDirectory()) {
            throw new Error("Refusing to delete directory");
          }
          unlinkSync(target);
          return ok({ deleted: true, path: relPath });
        }

        return err("Not found", 404);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return err(message, 500);
      }
    },
  });

  const protocol = config.tls ? "https" : "http";
  console.log(`Zoraxy agent ${AGENT_VERSION} listening on ${protocol}://${config.listenAddr}:${config.listenPort}`);

  const shutdown = () => {
    console.log("Shutting down Zoraxy agent...");
    server.stop(true);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Agent failed to start:", error);
  process.exit(1);
});

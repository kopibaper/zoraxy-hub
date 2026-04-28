import type {
  INodeConnector,
  NodeSystemInfo,
  DockerStatus,
  FileEntry,
  VpsSystemInfo,
  ServiceStatus,
} from "./interface";
import type {
  ZoraxyProxyEntry,
  ZoraxyCertInfo,
  ZoraxyStatsResponse,
  ZoraxyNetstatResponse,
  ZoraxyUptimeResponse,
  ZoraxyOrigin,
} from "../zoraxy/types";

export class AgentConnector implements INodeConnector {
  private readonly agentUrl: string;
  private readonly apiKey: string;
  private connected = false;

  constructor(agentUrl: string, apiKey: string) {
    this.agentUrl = agentUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async rpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.agentUrl}/api/v1/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ method, params: params ?? {} }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Agent RPC failed (${response.status}): ${text}`);
    }

    const envelope = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: string;
    };

    if (!envelope.ok) {
      throw new Error(envelope.error || "Agent RPC error");
    }

    return envelope.data as T;
  }

  private async agentGet<T>(path: string): Promise<T> {
    const response = await fetch(`${this.agentUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    const envelope = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: string;
    };

    if (!envelope.ok) {
      throw new Error(envelope.error || "Agent error");
    }

    return envelope.data as T;
  }

  private async agentPost<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.agentUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const envelope = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: string;
    };

    if (!envelope.ok) {
      throw new Error(envelope.error || "Agent error");
    }

    return envelope.data as T;
  }

  private async agentPut<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.agentUrl}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const envelope = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: string;
    };

    if (!envelope.ok) {
      throw new Error(envelope.error || "Agent error");
    }

    return envelope.data as T;
  }

  private async agentDelete<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.agentUrl}${path}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const envelope = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: string;
    };

    if (!envelope.ok) {
      throw new Error(envelope.error || "Agent error");
    }

    return envelope.data as T;
  }

  async connect(): Promise<void> {
    const ok = await this.testConnection();
    if (!ok) {
      throw new Error("Cannot reach agent");
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.agentGet("/api/v1/ping");
      return true;
    } catch {
      return false;
    }
  }

  async listProxyRules(): Promise<ZoraxyProxyEntry[]> {
    return this.rpc<ZoraxyProxyEntry[]>("proxy.list");
  }

  async getProxyDetail(domain: string): Promise<ZoraxyProxyEntry> {
    // Read config file directly — Zoraxy's /api/proxy/detail requires auth/CSRF and is unreliable via agent
    const sanitized = domain
      .replace(/\*/g, "(ST)")
      .replace(/\?/g, "(QM)")
      .replace(/\[/g, "(OB)")
      .replace(/\]/g, "(CB)")
      .replace(/#/g, "(HT)");
    const candidates = [
      `config/conf/proxy/${sanitized}.config`,
      `conf/proxy/${sanitized}.config`,
    ];
    for (const configPath of candidates) {
      try {
        const content = await this.readConfigFile(configPath);
        return JSON.parse(content) as ZoraxyProxyEntry;
      } catch {
        continue;
      }
    }
    throw new Error(`Proxy config file not found for domain: ${domain}`);
  }

  async addProxyRule(
    proxyType: string,
    rootDomain: string,
    origin: string,
    requireTLS: boolean
  ): Promise<void> {
    await this.rpc("proxy.add", { proxyType, rootDomain, origin, requireTLS });
  }

  async editProxyRule(domain: string, updates: Record<string, unknown>): Promise<void> {
    await this.rpc("proxy.edit", { domain, updates });
  }

  async deleteProxyRule(domain: string): Promise<void> {
    await this.rpc("proxy.delete", { domain });
  }

  async toggleProxyRule(domain: string, enabled: boolean): Promise<void> {
    await this.rpc("proxy.toggle", { domain, enabled });
  }

  async listUpstreams(domain: string): Promise<ZoraxyOrigin[]> {
    return this.rpc<ZoraxyOrigin[]>("upstream.list", { domain });
  }

  async addUpstream(
    domain: string,
    origin: string,
    requireTLS: boolean,
    skipCertValidation = false,
    weight = 1
  ): Promise<void> {
    await this.rpc("upstream.add", {
      domain,
      origin,
      requireTLS,
      skipCertValidation,
      weight,
    });
  }

  async removeUpstream(domain: string, origin: string): Promise<void> {
    await this.rpc("upstream.remove", { domain, origin });
  }

  async addVirtualDirectory(
    rootDomain: string,
    matchingPath: string,
    domain: string,
    requireTLS: boolean,
    skipCertValidation: boolean
  ): Promise<void> {
    await this.rpc("vdir.add", {
      rootDomain,
      matchingPath,
      domain,
      requireTLS,
      skipCertValidation,
    });
  }

  async deleteVirtualDirectory(rootDomain: string, matchingPath: string): Promise<void> {
    await this.rpc("vdir.delete", { rootDomain, matchingPath });
  }

  async addHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string,
    value: string,
    isRemove: boolean
  ): Promise<void> {
    await this.rpc("header.add", { rootDomain, direction, key, value, isRemove });
  }

  async deleteHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string
  ): Promise<void> {
    await this.rpc("header.delete", { rootDomain, direction, key });
  }

  async setDomainAliases(rootDomain: string, aliases: string[]): Promise<void> {
    await this.rpc("alias.set", { rootDomain, aliases });
  }

  async listCerts(): Promise<ZoraxyCertInfo[]> {
    return this.rpc<ZoraxyCertInfo[]>("cert.list");
  }

  async uploadCert(domain: string, certPem: string, keyPem: string): Promise<void> {
    await this.rpc("cert.upload", { domain, certPem, keyPem });
  }

  async deleteCert(domain: string): Promise<void> {
    await this.rpc("cert.delete", { domain });
  }

  async obtainACME(domains: string[], email: string): Promise<void> {
    await this.rpc("acme.obtain", { domains, email });
  }

  async listAccessRules(): Promise<unknown[]> {
    return this.rpc<unknown[]>("access.list");
  }

  async addBlacklist(ruleId: string, ip: string, comment = ""): Promise<void> {
    await this.rpc("blacklist.add", { ruleId, ip, comment });
  }

  async addWhitelist(ruleId: string, ip: string, comment = ""): Promise<void> {
    await this.rpc("whitelist.add", { ruleId, ip, comment });
  }

  async listStreamProxies(): Promise<unknown[]> {
    return this.rpc<unknown[]>("stream.list");
  }

  async addStreamProxy(config: Record<string, unknown>): Promise<void> {
    await this.rpc("stream.add", config);
  }

  async removeStreamProxy(id: string): Promise<void> {
    await this.rpc("stream.remove", { id });
  }

  async listRedirects(): Promise<unknown[]> {
    return this.rpc<unknown[]>("redirect.list");
  }

  async addRedirect(redirectUrl: string, destUrl: string, statusCode = 302): Promise<void> {
    await this.rpc("redirect.add", { redirectUrl, destUrl, statusCode });
  }

  async deleteRedirect(id: string): Promise<void> {
    await this.rpc("redirect.delete", { id });
  }

  async getStatsSummary(): Promise<ZoraxyStatsResponse> {
    return this.rpc<ZoraxyStatsResponse>("stats.summary");
  }

  async getNetstat(): Promise<ZoraxyNetstatResponse> {
    return this.rpc<ZoraxyNetstatResponse>("stats.netstat");
  }

  async getUptimeStatus(): Promise<ZoraxyUptimeResponse> {
    return this.rpc<ZoraxyUptimeResponse>("stats.uptime");
  }

  async getSystemInfo(): Promise<NodeSystemInfo> {
    try {
      const zoraxyInfo = await this.rpc<Record<string, unknown>>("system.info");
      let vpsInfo: VpsSystemInfo | null = null;

      try {
        vpsInfo = await this.agentGet<VpsSystemInfo>("/api/v1/info");
      } catch {
        // agent info optional
      }

      const bootTime = typeof zoraxyInfo.BootTime === "number" ? zoraxyInfo.BootTime : null;

      return {
        zoraxyVersion: typeof zoraxyInfo.Version === "string" ? zoraxyInfo.Version : null,
        nodeUUID: typeof zoraxyInfo.NodeUUID === "string" ? zoraxyInfo.NodeUUID : null,
        development: typeof zoraxyInfo.Development === "boolean" ? zoraxyInfo.Development : null,
        bootTime,
        enableSshLoopback: typeof zoraxyInfo.EnableSshLoopback === "boolean" ? zoraxyInfo.EnableSshLoopback : null,
        zerotierConnected: typeof zoraxyInfo.ZerotierConnected === "boolean" ? zoraxyInfo.ZerotierConnected : null,
        uptime:
          vpsInfo?.uptimeSeconds ??
          (bootTime ? Math.max(0, Math.floor(Date.now() / 1000) - bootTime) : null),
        cpu: vpsInfo?.cpuUsagePercent ?? null,
        memory: vpsInfo?.memoryUsedPercent ?? null,
      };
    } catch {
      return {
        zoraxyVersion: null,
        nodeUUID: null,
        development: null,
        bootTime: null,
        enableSshLoopback: null,
        zerotierConnected: null,
        uptime: null,
        cpu: null,
        memory: null,
      };
    }
  }

  async exportConfig(): Promise<unknown> {
    return this.rpc("config.export");
  }

  async getAutoRenewDomains(): Promise<string[]> {
    return this.rpc<string[]>("acme.autoRenewDomains");
  }

  async getBlacklist(ruleId: string): Promise<unknown> {
    return this.rpc("blacklist.get", { ruleId });
  }

  async getWhitelist(ruleId: string): Promise<unknown> {
    return this.rpc("whitelist.get", { ruleId });
  }

  async removeBlacklist(ruleId: string, ip: string): Promise<void> {
    await this.rpc("blacklist.remove", { ruleId, ip });
  }

  async removeWhitelist(ruleId: string, ip: string): Promise<void> {
    await this.rpc("whitelist.remove", { ruleId, ip });
  }

  async startStreamProxy(id: string): Promise<void> {
    await this.rpc("stream.start", { id });
  }

  async stopStreamProxy(id: string): Promise<void> {
    await this.rpc("stream.stop", { id });
  }

  async editRedirect(
    id: string,
    redirectUrl: string,
    destUrl: string,
    statusCode: number,
    forwardChildpath: boolean
  ): Promise<void> {
    await this.rpc("redirect.edit", {
      id,
      redirectUrl,
      destUrl,
      statusCode,
      forwardChildpath,
    });
  }

  supportsDocker(): boolean {
    return true;
  }

  supportsFileAccess(): boolean {
    return true;
  }

  supportsServiceManagement(): boolean {
    return true;
  }

  async getDockerStatus(): Promise<DockerStatus> {
    return this.agentGet<DockerStatus>("/api/v1/docker/status");
  }

  async dockerRestart(): Promise<void> {
    await this.agentPost("/api/v1/docker/restart");
  }

  async dockerStop(): Promise<void> {
    await this.agentPost("/api/v1/docker/stop");
  }

  async dockerStart(): Promise<void> {
    await this.agentPost("/api/v1/docker/start");
  }

  async getDockerLogs(tail = 100, since?: string): Promise<string> {
    let path = `/api/v1/docker/logs?tail=${tail}`;
    if (since) {
      path += `&since=${encodeURIComponent(since)}`;
    }
    const result = await this.agentGet<{ logs: string }>(path);
    return result.logs;
  }

  async listConfigFiles(dirPath = "."): Promise<FileEntry[]> {
    return this.agentGet<FileEntry[]>(`/api/v1/files?path=${encodeURIComponent(dirPath)}`);
  }

  async readConfigFile(filePath: string): Promise<string> {
    const result = await this.agentGet<{ path: string; content: string }>(
      `/api/v1/files/read?path=${encodeURIComponent(filePath)}`
    );
    return result.content;
  }

  async writeConfigFile(filePath: string, content: string): Promise<void> {
    await this.agentPut("/api/v1/files/write", { path: filePath, content });
  }

  async deleteConfigFile(filePath: string): Promise<void> {
    await this.agentDelete("/api/v1/files/delete", { path: filePath });
  }

  async restartService(): Promise<void> {
    await this.agentPost("/api/v1/service/restart");
  }

  async stopService(): Promise<void> {
    await this.agentPost("/api/v1/service/stop");
  }

  async startService(): Promise<void> {
    await this.agentPost("/api/v1/service/start");
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return this.agentGet<ServiceStatus>("/api/v1/service/status");
  }

  async getVpsInfo(): Promise<VpsSystemInfo> {
    return this.agentGet<VpsSystemInfo>("/api/v1/info");
  }
}

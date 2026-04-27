import type {
  ZoraxyConnectionConfig,
  ZoraxyProxyEntry,
  ZoraxyCertInfo,
  ZoraxyStatsResponse,
  ZoraxyNetstatResponse,
  ZoraxySystemInfo,
  ZoraxyUptimeResponse,
  ZoraxyOrigin,
} from "./types";
import { getSession, clearSession } from "./auth";
import { ZoraxyApiError } from "../errors";

export class ZoraxyClient {
  private config: ZoraxyConnectionConfig;
  private baseUrl: string;

  constructor(config: ZoraxyConnectionConfig) {
    this.config = config;
    this.baseUrl = `${config.protocol}://${config.host}:${config.port}`;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown> | FormData,
    _isRetry = false
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (!this.config.noauth) {
      const session = await getSession(this.config);
      if (session.cookie) {
        headers["Cookie"] = session.cookie;
      }
      if (session.csrfToken && method !== "GET") {
        headers["X-CSRF-Token"] = session.csrfToken;
      }
    }

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

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 401) {
      clearSession(this.config);
      // Retry once with a fresh session
      if (!_isRetry) {
        return this.request<T>(method, path, body, true);
      }
      throw new ZoraxyApiError(path, "Session expired", 401);
    }

    if (response.status === 403) {
      // Consume the body before retrying to avoid leaks
      const text = await response.text().catch(() => "CSRF/auth failure");
      clearSession(this.config);
      // CSRF token likely stale — retry once with a fresh session + new CSRF token
      if (!_isRetry) {
        return this.request<T>(method, path, body, true);
      }
      throw new ZoraxyApiError(path, `Forbidden: ${text}`, 403);
    }

    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new ZoraxyApiError(path, text || `HTTP ${response.status}`, response.status);
      }
      data = text as unknown as T;
    }

    if (!response.ok) {
      const errorMsg = typeof data === "object" && data !== null && "error" in data
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${response.status}`;
      throw new ZoraxyApiError(path, errorMsg, response.status);
    }

    return data;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.config.noauth) {
        const res = await fetch(`${this.baseUrl}/api/auth/checkLogin`, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
        });
        return res.ok;
      }
      await getSession(this.config);
      return true;
    } catch {
      return false;
    }
  }

  // --- Proxy Management ---

  async listProxyRules(): Promise<ZoraxyProxyEntry[]> {
    const result = await this.request<ZoraxyProxyEntry[]>("GET", "/api/proxy/list?type=host");
    return Array.isArray(result) ? result : [];
  }

  async getProxyDetail(rootDomain: string): Promise<ZoraxyProxyEntry> {
    return this.request<ZoraxyProxyEntry>("POST", "/api/proxy/detail", {
      type: "host",
      rootname: rootDomain,
    });
  }

  async addProxyRule(
    proxyType: string,
    rootDomain: string,
    origin: string,
    requireTLS: boolean
  ): Promise<void> {
    await this.request("POST", "/api/proxy/add", {
      type: proxyType,
      rootname: rootDomain,
      origin,
      tls: requireTLS.toString(),
    });
  }

  async deleteProxyRule(rootDomain: string): Promise<void> {
    await this.request("POST", "/api/proxy/del", {
      ep: rootDomain,
    });
  }

  async toggleProxyRule(rootDomain: string, enabled: boolean): Promise<void> {
    await this.request("POST", "/api/proxy/toggle", {
      ep: rootDomain,
      enabled: enabled.toString(),
    });
  }

  async editProxyRule(rootDomain: string, updates: Record<string, unknown>): Promise<void> {
    await this.request("POST", "/api/proxy/edit", {
      ep: rootDomain,
      ...updates,
    });
  }

  // --- Upstream / Load Balancing ---

  async listUpstreams(rootDomain: string): Promise<ZoraxyOrigin[]> {
    const result = await this.request<ZoraxyOrigin[]>("POST", "/api/proxy/upstream/list", {
      ep: rootDomain,
    });
    return Array.isArray(result) ? result : [];
  }

  async addUpstream(
    rootDomain: string,
    origin: string,
    requireTLS: boolean,
    skipCertValidation: boolean = false,
    weight: number = 1
  ): Promise<void> {
    await this.request("POST", "/api/proxy/upstream/add", {
      ep: rootDomain,
      origin,
      tls: requireTLS.toString(),
      tlsval: skipCertValidation.toString(),
      weight: weight.toString(),
    });
  }

  async removeUpstream(rootDomain: string, origin: string): Promise<void> {
    await this.request("POST", "/api/proxy/upstream/remove", {
      ep: rootDomain,
      origin,
    });
  }

  async addVirtualDirectory(
    rootDomain: string,
    matchingPath: string,
    domain: string,
    requireTLS: boolean,
    skipCertValidation: boolean
  ): Promise<void> {
    await this.request("POST", "/api/proxy/vdir/add", {
      ep: rootDomain,
      matchingPath,
      domain,
      tls: requireTLS.toString(),
      skipCertValidation: skipCertValidation.toString(),
    });
  }

  async deleteVirtualDirectory(rootDomain: string, matchingPath: string): Promise<void> {
    await this.request("POST", "/api/proxy/vdir/del", {
      ep: rootDomain,
      matchingPath,
    });
  }

  async addHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string,
    value: string,
    isRemove: boolean
  ): Promise<void> {
    await this.request("POST", "/api/proxy/header/add", {
      ep: rootDomain,
      direction,
      name: key,
      value,
      isRemove: isRemove.toString(),
    });
  }

  async deleteHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string
  ): Promise<void> {
    await this.request("POST", "/api/proxy/header/remove", {
      ep: rootDomain,
      direction,
      name: key,
    });
  }

  async setDomainAliases(rootDomain: string, aliases: string[]): Promise<void> {
    await this.request("POST", "/api/proxy/setAlias", {
      ep: rootDomain,
      alias: aliases.join(","),
    });
  }

  // --- Certificates ---

  async listCerts(): Promise<ZoraxyCertInfo[]> {
    const result = await this.request<ZoraxyCertInfo[]>("GET", "/api/cert/list");
    return Array.isArray(result) ? result : [];
  }

  async uploadCert(domain: string, certPem: string, keyPem: string): Promise<void> {
    const formData = new FormData();
    formData.append("domain", domain);
    formData.append(
      "cert",
      new Blob([certPem], { type: "application/x-pem-file" }),
      "cert.pem"
    );
    formData.append(
      "key",
      new Blob([keyPem], { type: "application/x-pem-file" }),
      "key.pem"
    );
    await this.request("POST", "/api/cert/upload", formData);
  }

  async deleteCert(domain: string): Promise<void> {
    await this.request("POST", "/api/cert/delete", { domain });
  }

  async obtainACME(domains: string[], email: string): Promise<void> {
    await this.request("POST", "/api/acme/obtainCert", {
      domains: domains.join(","),
      email,
    });
  }

  // --- Access Control ---

  async listAccessRules(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/access/list");
  }

  async getBlacklist(ruleId: string): Promise<unknown> {
    return this.request("POST", "/api/blacklist/list", { id: ruleId });
  }

  async addBlacklist(ruleId: string, ip: string, comment: string = ""): Promise<void> {
    await this.request("POST", "/api/blacklist/add", {
      id: ruleId,
      ip,
      comment,
    });
  }

  async getWhitelist(ruleId: string): Promise<unknown> {
    return this.request("POST", "/api/whitelist/list", { id: ruleId });
  }

  async addWhitelist(ruleId: string, ip: string, comment: string = ""): Promise<void> {
    await this.request("POST", "/api/whitelist/add", {
      id: ruleId,
      ip,
      comment,
    });
  }

  // --- Stream Proxy ---

  async listStreamProxies(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/streamprox/list");
  }

  async addStreamProxy(config: Record<string, unknown>): Promise<void> {
    await this.request("POST", "/api/streamprox/add", config);
  }

  async removeStreamProxy(id: string): Promise<void> {
    await this.request("POST", "/api/streamprox/remove", { id });
  }

  // --- Redirections ---

  async listRedirects(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/redirect/list");
  }

  async addRedirect(redirectUrl: string, destUrl: string, statusCode: number = 302): Promise<void> {
    await this.request("POST", "/api/redirect/add", {
      redirectUrl,
      destUrl,
      statusCode: statusCode.toString(),
    });
  }

  async deleteRedirect(id: string): Promise<void> {
    await this.request("POST", "/api/redirect/delete", { id });
  }

  // --- Statistics ---

  async getStatsSummary(): Promise<ZoraxyStatsResponse> {
    return this.request<ZoraxyStatsResponse>("GET", "/api/stats/summary");
  }

  async getNetstat(): Promise<ZoraxyNetstatResponse> {
    return this.request<ZoraxyNetstatResponse>("GET", "/api/stats/netstat");
  }

  async getTrafficByCountry(): Promise<Record<string, number>> {
    const summary = await this.getStatsSummary();
    return summary.RequestOrigin;
  }

  async getUptimeStatus(): Promise<ZoraxyUptimeResponse> {
    return this.request<ZoraxyUptimeResponse>("GET", "/api/utm/list");
  }

  // --- System ---

  async getSystemInfo(): Promise<ZoraxySystemInfo> {
    return this.request<ZoraxySystemInfo>("GET", "/api/info/x");
  }

  async exportConfig(): Promise<unknown> {
    return this.request("GET", "/api/conf/export");
  }

  async getAutoRenewDomains(): Promise<string[]> {
    const result = await this.request<unknown>("GET", "/api/acme/autoRenew/listDomains");

    if (Array.isArray(result)) {
      return result.filter((item): item is string => typeof item === "string");
    }

    if (result && typeof result === "object") {
      for (const key of ["domains", "data", "list"]) {
        const value = (result as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === "string");
        }
      }
    }

    return [];
  }

  async removeBlacklist(ruleId: string, ip: string): Promise<void> {
    await this.request("POST", "/api/blacklist/remove", { id: ruleId, ip });
  }

  async removeWhitelist(ruleId: string, ip: string): Promise<void> {
    await this.request("POST", "/api/whitelist/remove", { id: ruleId, ip });
  }

  async startStreamProxy(id: string): Promise<void> {
    await this.request("POST", "/api/streamprox/start", { id });
  }

  async stopStreamProxy(id: string): Promise<void> {
    await this.request("POST", "/api/streamprox/stop", { id });
  }

  async editRedirect(
    id: string,
    redirectUrl: string,
    destUrl: string,
    statusCode: number,
    forwardChildpath: boolean
  ): Promise<void> {
    await this.request("POST", "/api/redirect/edit", {
      id,
      redirectUrl,
      destUrl,
      statusCode: statusCode.toString(),
      forwardChildpath: forwardChildpath.toString(),
    });
  }
}

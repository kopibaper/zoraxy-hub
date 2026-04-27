import type { INodeConnector, NodeSystemInfo } from "./interface";
import type {
  ZoraxyProxyEntry,
  ZoraxyCertInfo,
  ZoraxyStatsResponse,
  ZoraxyNetstatResponse,
  ZoraxyUptimeResponse,
  ZoraxyOrigin,
} from "../zoraxy/types";
import { ZoraxyClient } from "../zoraxy/client";

export class DirectConnector implements INodeConnector {
  private client: ZoraxyClient;
  private connected = false;

  constructor(
    host: string,
    port: number,
    protocol: "http" | "https",
    username?: string,
    password?: string,
    noauth?: boolean
  ) {
    this.client = new ZoraxyClient({ host, port, protocol, username, password, noauth });
  }

  async connect(): Promise<void> {
    const ok = await this.client.testConnection();
    if (!ok) throw new Error("Failed to connect to Zoraxy instance");
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  async listProxyRules(): Promise<ZoraxyProxyEntry[]> {
    return this.client.listProxyRules();
  }

  async getProxyDetail(domain: string): Promise<ZoraxyProxyEntry> {
    return this.client.getProxyDetail(domain);
  }

  async addProxyRule(
    proxyType: string,
    rootDomain: string,
    origin: string,
    requireTLS: boolean
  ): Promise<void> {
    return this.client.addProxyRule(proxyType, rootDomain, origin, requireTLS);
  }

  async editProxyRule(domain: string, updates: Record<string, unknown>): Promise<void> {
    return this.client.editProxyRule(domain, updates);
  }

  async deleteProxyRule(domain: string): Promise<void> {
    return this.client.deleteProxyRule(domain);
  }

  async toggleProxyRule(domain: string, enabled: boolean): Promise<void> {
    return this.client.toggleProxyRule(domain, enabled);
  }

  async listUpstreams(domain: string): Promise<ZoraxyOrigin[]> {
    return this.client.listUpstreams(domain);
  }

  async addUpstream(
    domain: string,
    origin: string,
    requireTLS: boolean,
    skipCertValidation = false,
    weight = 1
  ): Promise<void> {
    return this.client.addUpstream(domain, origin, requireTLS, skipCertValidation, weight);
  }

  async removeUpstream(domain: string, origin: string): Promise<void> {
    return this.client.removeUpstream(domain, origin);
  }

  async addVirtualDirectory(
    rootDomain: string,
    matchingPath: string,
    domain: string,
    requireTLS: boolean,
    skipCertValidation: boolean
  ): Promise<void> {
    return this.client.addVirtualDirectory(
      rootDomain,
      matchingPath,
      domain,
      requireTLS,
      skipCertValidation
    );
  }

  async deleteVirtualDirectory(rootDomain: string, matchingPath: string): Promise<void> {
    return this.client.deleteVirtualDirectory(rootDomain, matchingPath);
  }

  async addHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string,
    value: string,
    isRemove: boolean
  ): Promise<void> {
    return this.client.addHeaderRewriteRule(rootDomain, direction, key, value, isRemove);
  }

  async deleteHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string
  ): Promise<void> {
    return this.client.deleteHeaderRewriteRule(rootDomain, direction, key);
  }

  async setDomainAliases(rootDomain: string, aliases: string[]): Promise<void> {
    return this.client.setDomainAliases(rootDomain, aliases);
  }

  async listCerts(): Promise<ZoraxyCertInfo[]> {
    return this.client.listCerts();
  }

  async uploadCert(domain: string, certPem: string, keyPem: string): Promise<void> {
    return this.client.uploadCert(domain, certPem, keyPem);
  }

  async deleteCert(domain: string): Promise<void> {
    return this.client.deleteCert(domain);
  }

  async obtainACME(domains: string[], email: string): Promise<void> {
    return this.client.obtainACME(domains, email);
  }

  async listAccessRules(): Promise<unknown[]> {
    return this.client.listAccessRules();
  }

  async addBlacklist(ruleId: string, ip: string, comment = ""): Promise<void> {
    return this.client.addBlacklist(ruleId, ip, comment);
  }

  async addWhitelist(ruleId: string, ip: string, comment = ""): Promise<void> {
    return this.client.addWhitelist(ruleId, ip, comment);
  }

  async listStreamProxies(): Promise<unknown[]> {
    return this.client.listStreamProxies();
  }

  async addStreamProxy(config: Record<string, unknown>): Promise<void> {
    return this.client.addStreamProxy(config);
  }

  async removeStreamProxy(id: string): Promise<void> {
    return this.client.removeStreamProxy(id);
  }

  async listRedirects(): Promise<unknown[]> {
    return this.client.listRedirects();
  }

  async addRedirect(redirectUrl: string, destUrl: string, statusCode = 302): Promise<void> {
    return this.client.addRedirect(redirectUrl, destUrl, statusCode);
  }

  async deleteRedirect(id: string): Promise<void> {
    return this.client.deleteRedirect(id);
  }

  async getStatsSummary(): Promise<ZoraxyStatsResponse> {
    return this.client.getStatsSummary();
  }

  async getNetstat(): Promise<ZoraxyNetstatResponse> {
    return this.client.getNetstat();
  }

  async getUptimeStatus(): Promise<ZoraxyUptimeResponse> {
    return this.client.getUptimeStatus();
  }

  async getSystemInfo(): Promise<NodeSystemInfo> {
    try {
      const info = await this.client.getSystemInfo();
      const computedUptime =
        typeof info.BootTime === "number"
          ? Math.max(0, Math.floor(Date.now() / 1000) - info.BootTime)
          : null;

      return {
        zoraxyVersion: info.Version || null,
        nodeUUID: info.NodeUUID || null,
        development: info.Development ?? null,
        bootTime: info.BootTime ?? null,
        enableSshLoopback: info.EnableSshLoopback ?? null,
        zerotierConnected: info.ZerotierConnected ?? null,
        uptime: computedUptime,
        cpu: null,
        memory: null,
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
    return this.client.exportConfig();
  }

  async getAutoRenewDomains(): Promise<string[]> {
    return this.client.getAutoRenewDomains();
  }

  async getBlacklist(ruleId: string): Promise<unknown> {
    return this.client.getBlacklist(ruleId);
  }

  async getWhitelist(ruleId: string): Promise<unknown> {
    return this.client.getWhitelist(ruleId);
  }

  async removeBlacklist(ruleId: string, ip: string): Promise<void> {
    return this.client.removeBlacklist(ruleId, ip);
  }

  async removeWhitelist(ruleId: string, ip: string): Promise<void> {
    return this.client.removeWhitelist(ruleId, ip);
  }

  async startStreamProxy(id: string): Promise<void> {
    return this.client.startStreamProxy(id);
  }

  async stopStreamProxy(id: string): Promise<void> {
    return this.client.stopStreamProxy(id);
  }

  async editRedirect(
    id: string,
    redirectUrl: string,
    destUrl: string,
    statusCode: number,
    forwardChildpath: boolean
  ): Promise<void> {
    return this.client.editRedirect(
      id,
      redirectUrl,
      destUrl,
      statusCode,
      forwardChildpath
    );
  }
}

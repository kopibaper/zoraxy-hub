import type {
  ZoraxyProxyEntry,
  ZoraxyCertInfo,
  ZoraxyStatsResponse,
  ZoraxyNetstatResponse,
  ZoraxyUptimeResponse,
  ZoraxyOrigin,
} from "../zoraxy/types";

export interface NodeSystemInfo {
  zoraxyVersion: string | null;
  nodeUUID: string | null;
  development: boolean | null;
  bootTime: number | null;
  enableSshLoopback: boolean | null;
  zerotierConnected: boolean | null;
  uptime: number | null;
  cpu: number | null;
  cpuCount: number | null;
  memory: number | null;
  memoryTotal: number | null;
  memoryUsed: number | null;
}

export interface DockerStatus {
  status: "running" | "stopped" | "not_found";
  id?: string;
  image?: string;
  startedAt?: string;
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

export interface VpsSystemInfo {
  hostname: string;
  platform: string;
  cpuCount: number;
  cpuUsagePercent: number;
  memoryTotal: number;
  memoryFree: number;
  memoryUsedPercent: number;
  diskTotal: number;
  diskFree: number;
  uptimeSeconds: number;
  agentVersion: string;
}

export interface ServiceStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
}

export interface INodeConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;

  listProxyRules(): Promise<ZoraxyProxyEntry[]>;
  getProxyDetail(domain: string): Promise<ZoraxyProxyEntry>;
  addProxyRule(
    proxyType: string,
    rootDomain: string,
    origin: string,
    requireTLS: boolean
  ): Promise<void>;
  editProxyRule(domain: string, updates: Record<string, unknown>): Promise<void>;
  deleteProxyRule(domain: string): Promise<void>;
  toggleProxyRule(domain: string, enabled: boolean): Promise<void>;

  listUpstreams(domain: string): Promise<ZoraxyOrigin[]>;
  addUpstream(
    domain: string,
    origin: string,
    requireTLS: boolean,
    skipCertValidation?: boolean,
    weight?: number
  ): Promise<void>;
  removeUpstream(domain: string, origin: string): Promise<void>;
  addVirtualDirectory(
    rootDomain: string,
    matchingPath: string,
    domain: string,
    requireTLS: boolean,
    skipCertValidation: boolean
  ): Promise<void>;
  deleteVirtualDirectory(rootDomain: string, matchingPath: string): Promise<void>;
  addHeaderRewriteRule(
    rootDomain: string,
    direction: string,
    key: string,
    value: string,
    isRemove: boolean
  ): Promise<void>;
  deleteHeaderRewriteRule(rootDomain: string, direction: string, key: string): Promise<void>;
  setDomainAliases(rootDomain: string, aliases: string[]): Promise<void>;

  listCerts(): Promise<ZoraxyCertInfo[]>;
  uploadCert(domain: string, certPem: string, keyPem: string): Promise<void>;
  deleteCert(domain: string): Promise<void>;
  obtainACME(domains: string[], email: string): Promise<void>;

  listAccessRules(): Promise<unknown[]>;
  addBlacklist(ruleId: string, ip: string, comment?: string): Promise<void>;
  addWhitelist(ruleId: string, ip: string, comment?: string): Promise<void>;

  listStreamProxies(): Promise<unknown[]>;
  addStreamProxy(config: Record<string, unknown>): Promise<void>;
  removeStreamProxy(id: string): Promise<void>;

  listRedirects(): Promise<unknown[]>;
  addRedirect(redirectUrl: string, destUrl: string, statusCode?: number): Promise<void>;
  deleteRedirect(id: string): Promise<void>;

  getStatsSummary(): Promise<ZoraxyStatsResponse>;
  getNetstat(): Promise<ZoraxyNetstatResponse>;
  getUptimeStatus(): Promise<ZoraxyUptimeResponse>;

  getSystemInfo(): Promise<NodeSystemInfo>;
  exportConfig(): Promise<unknown>;
  getAutoRenewDomains(): Promise<string[]>;
  getBlacklist(ruleId: string): Promise<unknown>;
  getWhitelist(ruleId: string): Promise<unknown>;
  removeBlacklist(ruleId: string, ip: string): Promise<void>;
  removeWhitelist(ruleId: string, ip: string): Promise<void>;
  startStreamProxy(id: string): Promise<void>;
  stopStreamProxy(id: string): Promise<void>;
  editRedirect(
    id: string,
    redirectUrl: string,
    destUrl: string,
    statusCode: number,
    forwardChildpath: boolean
  ): Promise<void>;

  // Agent-only capabilities (optional)
  supportsDocker?(): boolean;
  supportsFileAccess?(): boolean;
  supportsServiceManagement?(): boolean;

  getDockerStatus?(): Promise<DockerStatus>;
  dockerRestart?(): Promise<void>;
  dockerStop?(): Promise<void>;
  dockerStart?(): Promise<void>;
  getDockerLogs?(tail?: number, since?: string): Promise<string>;

  listConfigFiles?(path?: string): Promise<FileEntry[]>;
  readConfigFile?(path: string): Promise<string>;
  writeConfigFile?(path: string, content: string): Promise<void>;
  deleteConfigFile?(path: string): Promise<void>;

  restartService?(): Promise<void>;
  stopService?(): Promise<void>;
  startService?(): Promise<void>;
  getServiceStatus?(): Promise<ServiceStatus>;

  getVpsInfo?(): Promise<VpsSystemInfo>;
}

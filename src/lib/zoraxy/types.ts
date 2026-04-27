export interface ZoraxySession {
  cookie: string;
  csrfToken: string;
  expiresAt: number;
}

export interface ZoraxyConnectionConfig {
  host: string;
  port: number;
  protocol: "http" | "https";
  username?: string;
  password?: string;
  noauth?: boolean;
}

export interface ZoraxyApiResponse {
  error?: string;
  [key: string]: unknown;
}

export interface ZoraxyVirtualDirectory {
  MatchingPath: string;
  Domain: string;
  RequireTLS: boolean;
  SkipCertValidations: boolean;
  Disabled: boolean;
}

export interface ZoraxyHeaderRewriteRule {
  Direction: string;
  Key: string;
  Value: string;
  IsRemove: boolean;
}

export interface ZoraxyProxyEntry {
  ProxyType: string;
  RootOrMatchingDomain: string;
  MatchingDomainAlias: string[];
  ActiveOrigins: ZoraxyOrigin[];
  InactiveOrigins: ZoraxyOrigin[];
  UseStickySession: boolean;
  UseActiveLoadBalance: boolean;
  Disabled: boolean;
  BypassGlobalTLS: boolean;
  Tags: string[];
  VirtualDirectories: ZoraxyVirtualDirectory[];
  HeaderRewriteRules: ZoraxyHeaderRewriteRule[];
}

export interface ZoraxyOrigin {
  OriginIpOrDomain: string;
  RequireTLS: boolean;
  SkipCertValidations: boolean;
  SkipWebSocketOriginCheck: boolean;
  Weight: number;
  Disabled: boolean;
}

export interface ZoraxyCertInfo {
  Domain: string;
  LastModifiedDate: string;
  ExpireDate: string;
  RemainingDays: number;
  UseDNS: boolean;
}

export interface ZoraxyStatsResponse {
  TotalRequest: number;
  ErrorRequest: number;
  ValidRequest: number;
  ForwardTypes: Record<string, number>;
  RequestOrigin: Record<string, number>;
  RequestClientIp: Record<string, number>;
  RequestURL: Record<string, number>;
  UserAgents: Record<string, number>;
  StatusCodes: Record<string, number>;
  Referers: Record<string, number>;
}

export interface ZoraxyNetstatResponse {
  RX: number;
  TX: number;
}

export interface ZoraxySystemInfo {
  Version: string;
  NodeUUID: string;
  Development: boolean;
  BootTime: number;
  EnableSshLoopback: boolean;
  ZerotierConnected: boolean;
}

export interface ZoraxyUptimeEntry {
  Timestamp: number;
  ID: string;
  Name: string;
  URL: string;
  Protocol: string;
  Online: boolean;
  StatusCode: number;
  Latency: number;
}

export type ZoraxyUptimeResponse = Record<string, ZoraxyUptimeEntry[]>;

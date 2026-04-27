export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: "node" | "proxy" | "cert" | "template" | "system";
  entityId: string | null;
  nodeId: string | null;
  details: Record<string, unknown> | null;
  result: "success" | "failure";
  createdAt: string;
}

export interface SystemOverview {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  degradedNodes: number;
  unknownNodes?: number;
  totalProxyRules: number;
  totalCertificates: number;
  expiringCerts: number;
  totalRequests?: number;
  totalBandwidth?: number;
  requestOrigin?: Record<string, number>;
  RequestOrigin?: Record<string, number>;
  statusCodeDistribution?:
    | Record<string, number>
    | Array<{ code: string | number; count: number }>;
  bandwidthByNode?: Array<{
    nodeId?: string;
    nodeName?: string;
    name?: string;
    rx?: number;
    tx?: number;
    rxBytes?: number;
    txBytes?: number;
  }>;
  trafficSummary?: TrafficSummary;
  traffic?: {
    totalRequests: number;
    totalBandwidth: number;
    nodes: Array<{
      nodeId: string;
      nodeName: string;
      totalRequests: number;
      bandwidth: number;
      rx: number;
      tx: number;
      success: boolean;
      error?: string;
    }>;
  };
  recentActivity: AuditLogEntry[];
}

export interface TrafficSummary {
  totalRequests?: number;
  totalBandwidth?: number;
  topDomains?: { domain: string; requests: number }[];
  countryDistribution?: { country: string; count: number }[];
  TotalRequest?: number;
  ErrorRequest?: number;
  ValidRequest?: number;
  ForwardTypes?: Record<string, number>;
  RequestOrigin?: Record<string, number>;
  RequestClientIp?: Record<string, number>;
  RequestURL?: Record<string, number>;
  UserAgents?: Record<string, number>;
  StatusCodes?: Record<string, number>;
  Referers?: Record<string, number>;
  RX?: number;
  TX?: number;
}

export interface BulkOperationResult {
  nodeId: string;
  nodeName: string;
  success: boolean;
  error?: string;
}

export interface StreamProxy {
  ID: string;
  Name: string;
  ProxyAddr: string;
  ProxyPort: number;
  ListeningAddr: string;
  ListeningPort: number;
  Protocol: "tcp" | "udp";
  Running: boolean;
  Disabled: boolean;
}

export interface Redirect {
  ID: string;
  RedirectURL: string;
  DestURL: string;
  ForwardChildpath: boolean;
  StatusCode: number;
}

export interface AccessRule {
  ID: string;
  Name: string;
  BlacklistEnabled: boolean;
  WhitelistEnabled: boolean;
}

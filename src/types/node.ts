export type ConnectionMode = "direct" | "agent";
export type AuthMethod = "session" | "noauth" | "agent_key";
export type NodeStatus = "online" | "offline" | "degraded" | "unknown";

export interface Node {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: "http" | "https";
  connectionMode: ConnectionMode;
  authMethod: AuthMethod;
  agentToken: string | null;
  agentPort: number;
  agentTls: boolean;
  tags: string[];
  location: string | null;
  status: NodeStatus;
  lastSeen: string | null;
  zoraxyVersion: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface NodeCreateInput {
  name: string;
  host: string;
  port?: number;
  protocol?: "http" | "https";
  connectionMode: ConnectionMode;
  authMethod: AuthMethod;
  username?: string;
  password?: string;
  agentToken?: string;
  agentPort?: number;
  agentTls?: boolean;
  tags?: string[];
  location?: string;
}

export interface NodeUpdateInput {
  name?: string;
  host?: string;
  port?: number;
  protocol?: "http" | "https";
  connectionMode?: ConnectionMode;
  authMethod?: AuthMethod;
  username?: string;
  password?: string;
  agentToken?: string;
  agentPort?: number;
  agentTls?: boolean;
  tags?: string[];
  location?: string;
}

export interface NodeHealth {
  nodeId: string;
  status: NodeStatus;
  zoraxyVersion: string | null;
  uptime: number | null;
  cpu: number | null;
  memory: number | null;
  proxyCount: number | null;
  certCount: number | null;
  checkedAt: string;
}

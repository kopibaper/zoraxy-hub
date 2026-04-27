import type { INodeConnector } from "./interface";
import { DirectConnector } from "./direct";
import { AgentConnector } from "./agent";
import { decryptCredentials } from "../crypto";
import type { ConnectionMode, AuthMethod } from "@/types/node";

interface ConnectorConfig {
  id: string;
  host: string;
  port: number;
  protocol: "http" | "https";
  connectionMode: ConnectionMode;
  authMethod: AuthMethod;
  credentials: string | null;
  agentToken: string | null;
  agentPort?: number;
  agentTls?: boolean;
}

const connectorPool = new Map<string, INodeConnector>();

export function getConnector(config: ConnectorConfig): INodeConnector {
  const cached = connectorPool.get(config.id);
  if (cached) return cached;

  const connector = createConnector(config);
  connectorPool.set(config.id, connector);
  return connector;
}

export function createConnector(config: ConnectorConfig): INodeConnector {
  if (config.connectionMode === "agent") {
    const agentProtocol = config.agentTls ? "https" : "http";
    const agentPort = config.agentPort || 9191;
    const agentUrl = `${agentProtocol}://${config.host}:${agentPort}`;
    return new AgentConnector(agentUrl, config.agentToken || "");
  }

  let username: string | undefined;
  let password: string | undefined;

  if (config.authMethod === "session" && config.credentials) {
    const creds = decryptCredentials(config.credentials);
    username = creds.username;
    password = creds.password;
  }

  const noauth = config.authMethod === "noauth";

  return new DirectConnector(
    config.host,
    config.port,
    config.protocol,
    username,
    password,
    noauth
  );
}

export function removeConnector(nodeId: string): void {
  const connector = connectorPool.get(nodeId);
  if (connector) {
    connector.disconnect().catch(() => {});
    connectorPool.delete(nodeId);
  }
}

export function clearConnectors(): void {
  for (const connector of connectorPool.values()) {
    connector.disconnect().catch(() => {});
  }
  connectorPool.clear();
}

import { db } from "../db";
import { nodes } from "../db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { encryptCredentials } from "../crypto";
import { getConnector, removeConnector } from "../connectors/factory";
import { logAudit } from "./audit.service";
import { NotFoundError, ValidationError } from "../errors";
import type { NodeCreateInput, NodeUpdateInput } from "../validators/node";
import type { Node, NodeHealth } from "@/types/node";

function rowToNode(row: typeof nodes.$inferSelect): Node {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    protocol: row.protocol as "http" | "https",
    connectionMode: row.connectionMode as "direct" | "agent",
    authMethod: row.authMethod as "session" | "noauth" | "agent_key",
    agentToken: row.agentToken,
    agentPort: row.agentPort ?? 9191,
    agentTls: row.agentTls ?? false,
    tags: row.tags ? JSON.parse(row.tags) : [],
    location: row.location,
    status: row.status as Node["status"],
    lastSeen: row.lastSeen,
    zoraxyVersion: row.zoraxyVersion,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listNodes(): Promise<Node[]> {
  const rows = await db.select().from(nodes);
  return rows.map(rowToNode);
}

export async function getNode(id: string): Promise<Node> {
  const rows = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  if (rows.length === 0) throw new NotFoundError("Node", id);
  return rowToNode(rows[0]);
}

export async function createNode(input: NodeCreateInput): Promise<Node> {
  if (input.authMethod === "session" && (!input.username || !input.password)) {
    throw new ValidationError(
      "Username and password are required for session auth"
    );
  }

  const id = ulid();
  let credentials: string | null = null;

  if (input.username && input.password) {
    credentials = encryptCredentials({
      username: input.username,
      password: input.password,
    });
  }

  const now = new Date().toISOString();

  await db.insert(nodes).values({
    id,
    name: input.name,
    host: input.host,
    port: input.port ?? 8000,
    protocol: input.protocol ?? "https",
    connectionMode: input.connectionMode,
    authMethod: input.authMethod,
    credentials,
    agentToken: input.agentToken || null,
    agentPort: input.agentPort ?? 9191,
    agentTls: input.agentTls ?? false,
    tags: JSON.stringify(input.tags || []),
    location: input.location || null,
    status: "unknown",
    createdAt: now,
    updatedAt: now,
  });

  await logAudit("node.create", "node", id, id, {
    name: input.name,
    host: input.host,
    connectionMode: input.connectionMode,
  });

  return getNode(id);
}

export async function updateNode(
  id: string,
  input: NodeUpdateInput
): Promise<Node> {
  const existing = await getNode(id);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.host !== undefined) updates.host = input.host;
  if (input.port !== undefined) updates.port = input.port;
  if (input.protocol !== undefined) updates.protocol = input.protocol;
  if (input.connectionMode !== undefined) updates.connectionMode = input.connectionMode;
  if (input.authMethod !== undefined) updates.authMethod = input.authMethod;
  if (input.agentToken !== undefined) updates.agentToken = input.agentToken;
  if (input.agentPort !== undefined) updates.agentPort = input.agentPort;
  if (input.agentTls !== undefined) updates.agentTls = input.agentTls;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
  if (input.location !== undefined) updates.location = input.location;

  if (input.username && input.password) {
    updates.credentials = encryptCredentials({
      username: input.username,
      password: input.password,
    });
  }

  await db.update(nodes).set(updates).where(eq(nodes.id, id));

  removeConnector(id);

  await logAudit("node.update", "node", id, id, {
    name: existing.name,
    changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
  });

  return getNode(id);
}

export async function deleteNode(id: string): Promise<void> {
  const node = await getNode(id);
  removeConnector(id);
  await db.delete(nodes).where(eq(nodes.id, id));
  await logAudit("node.delete", "node", id, null, { name: node.name });
}

export async function testNodeConnection(id: string): Promise<boolean> {
  const node = await getNode(id);
  const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", id);

  const connector = getConnector({
    id: node.id,
    host: node.host,
    port: node.port,
    protocol: node.protocol,
    connectionMode: node.connectionMode,
    authMethod: node.authMethod,
    credentials: row[0].credentials,
    agentToken: node.agentToken,
    agentPort: node.agentPort,
    agentTls: node.agentTls,
  });

  const ok = await connector.testConnection();

  await db
    .update(nodes)
    .set({
      status: ok ? "online" : "offline",
      lastSeen: ok ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(nodes.id, id));

  return ok;
}

export async function getNodeHealth(id: string): Promise<NodeHealth> {
  const node = await getNode(id);
  const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", id);

  const connector = getConnector({
    id: node.id,
    host: node.host,
    port: node.port,
    protocol: node.protocol,
    connectionMode: node.connectionMode,
    authMethod: node.authMethod,
    credentials: row[0].credentials,
    agentToken: node.agentToken,
    agentPort: node.agentPort,
    agentTls: node.agentTls,
  });

  try {
    const sysInfo = await connector.getSystemInfo();
    const proxyRules = await connector.listProxyRules();
    const certs = await connector.listCerts();

    await db
      .update(nodes)
      .set({
        status: "online",
        lastSeen: new Date().toISOString(),
        zoraxyVersion: sysInfo.zoraxyVersion,
        metadata: JSON.stringify({
          uptime: sysInfo.uptime,
          cpu: sysInfo.cpu,
          memory: sysInfo.memory,
        }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(nodes.id, id));

    return {
      nodeId: id,
      status: "online",
      zoraxyVersion: sysInfo.zoraxyVersion,
      uptime: sysInfo.uptime,
      cpu: sysInfo.cpu,
      memory: sysInfo.memory,
      proxyCount: proxyRules.length,
      certCount: certs.length,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    await db
      .update(nodes)
      .set({
        status: "offline",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(nodes.id, id));

    return {
      nodeId: id,
      status: "offline",
      zoraxyVersion: null,
      uptime: null,
      cpu: null,
      memory: null,
      proxyCount: null,
      certCount: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function getNodeConnector(node: Node, credentials: string | null) {
  return getConnector({
    id: node.id,
    host: node.host,
    port: node.port,
    protocol: node.protocol,
    connectionMode: node.connectionMode,
    authMethod: node.authMethod,
    credentials,
    agentToken: node.agentToken,
    agentPort: node.agentPort,
    agentTls: node.agentTls,
  });
}

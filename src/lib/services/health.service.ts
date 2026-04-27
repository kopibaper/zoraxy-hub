import { db } from "../db";
import { nodes, nodeSnapshots } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getConnector } from "../connectors/factory";
import type { NodeStatus } from "@/types/node";
import type { ZoraxyNetstatResponse, ZoraxyStatsResponse } from "../zoraxy/types";
import { ulid } from "ulid";

export interface NodeHealthPollResult {
  id: string;
  name: string;
  status: NodeStatus;
  stats: ZoraxyStatsResponse | null;
  netstat: ZoraxyNetstatResponse | null;
  checkedAt: string;
}

async function storeSnapshot(
  nodeId: string,
  payload: {
    status: NodeStatus;
    stats: ZoraxyStatsResponse | null;
    netstat: ZoraxyNetstatResponse | null;
    checkedAt: string;
  }
) {
  await db.insert(nodeSnapshots).values({
    id: ulid(),
    nodeId,
    snapshotType: "full_config",
    data: JSON.stringify(payload),
    createdAt: payload.checkedAt,
  });

  const oldSnapshots = await db
    .select({ id: nodeSnapshots.id })
    .from(nodeSnapshots)
    .where(eq(nodeSnapshots.nodeId, nodeId))
    .orderBy(desc(nodeSnapshots.createdAt))
    .limit(1000)
    .offset(1000);

  if (oldSnapshots.length === 0) {
    return;
  }

  await db
    .delete(nodeSnapshots)
    .where(inArray(nodeSnapshots.id, oldSnapshots.map((snapshot) => snapshot.id)));
}

export async function checkAllNodesHealth(): Promise<
  NodeHealthPollResult[]
> {
  const allNodes = await db.select().from(nodes);
  return Promise.all(
    allNodes.map(async (node) => {
      const checkedAt = new Date().toISOString();
      let status: NodeStatus = "offline";
      let stats: ZoraxyStatsResponse | null = null;
      let netstat: ZoraxyNetstatResponse | null = null;
      let zoraxyVersion: string | null = null;

      try {
        const connector = getConnector({
          id: node.id,
          host: node.host,
          port: node.port,
          protocol: node.protocol as "http" | "https",
          connectionMode: node.connectionMode as "direct" | "agent",
          authMethod: node.authMethod as "session" | "noauth" | "agent_key",
          credentials: node.credentials,
          agentToken: node.agentToken,
          agentPort: node.agentPort ?? 9191,
          agentTls: node.agentTls ?? false,
        });

        const ok = await connector.testConnection();
        status = ok ? "online" : "offline";

        if (ok) {
          const [statsResult, netstatResult, systemInfoResult] = await Promise.all([
            connector.getStatsSummary().catch(() => null),
            connector.getNetstat().catch(() => null),
            connector.getSystemInfo().catch(() => null),
          ]);

          stats = statsResult;
          netstat = netstatResult;
          zoraxyVersion = systemInfoResult?.zoraxyVersion || null;
        }
      } catch {
        status = "offline";
      }

      const updates: {
        status: NodeStatus;
        lastSeen?: string;
        zoraxyVersion?: string;
        updatedAt: string;
      } = {
        status,
        updatedAt: checkedAt,
      };

      if (status === "online") {
        updates.lastSeen = checkedAt;
      }

      if (zoraxyVersion) {
        updates.zoraxyVersion = zoraxyVersion;
      }

      await db.update(nodes).set(updates).where(eq(nodes.id, node.id));

      await storeSnapshot(node.id, {
        status,
        stats,
        netstat,
        checkedAt,
      });

      return {
        id: node.id,
        name: node.name,
        status,
        stats,
        netstat,
        checkedAt,
      };
    })
  );
}

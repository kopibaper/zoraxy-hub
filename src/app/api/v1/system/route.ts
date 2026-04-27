import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
import { nodes, auditLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getConnector } from "@/lib/connectors/factory";

const NODE_STATS_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const [allNodes, recentAudit] = await Promise.all([
      db.select().from(nodes),
      db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(10),
    ]);

    const onlineNodes = allNodes.filter((n) => n.status === "online");

    const perNodeTraffic = await Promise.all(
      onlineNodes.map(async (node) => {
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

          const [summary, netstat] = await Promise.all([
            withTimeout(
              connector.getStatsSummary(),
              NODE_STATS_TIMEOUT_MS,
              `stats summary for node ${node.id}`
            ),
            withTimeout(
              connector.getNetstat(),
              NODE_STATS_TIMEOUT_MS,
              `netstat for node ${node.id}`
            ),
          ]);

          return {
            nodeId: node.id,
            nodeName: node.name,
            totalRequests: summary.TotalRequest ?? 0,
            bandwidth: (netstat.RX ?? 0) + (netstat.TX ?? 0),
            rx: netstat.RX ?? 0,
            tx: netstat.TX ?? 0,
            success: true,
          };
        } catch (error) {
          return {
            nodeId: node.id,
            nodeName: node.name,
            totalRequests: 0,
            bandwidth: 0,
            rx: 0,
            tx: 0,
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch node traffic stats",
          };
        }
      })
    );

    const totalRequests = perNodeTraffic.reduce((sum, node) => sum + node.totalRequests, 0);
    const totalBandwidth = perNodeTraffic.reduce((sum, node) => sum + node.bandwidth, 0);

    const overview = {
      totalNodes: allNodes.length,
      onlineNodes: onlineNodes.length,
      offlineNodes: allNodes.filter((n) => n.status === "offline").length,
      degradedNodes: allNodes.filter((n) => n.status === "degraded").length,
      unknownNodes: allNodes.filter((n) => n.status === "unknown").length,
      traffic: {
        totalRequests,
        totalBandwidth,
        nodes: perNodeTraffic,
      },
      recentActivity: recentAudit.map((a) => ({
        ...a,
        details: a.details ? JSON.parse(a.details) : null,
      })),
    };

    return Response.json({ success: true, data: overview });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { getConnector } from "@/lib/connectors/factory";

export interface NodeStats {
  nodeId: string;
  cpu: number | null;
  cpuCount: number | null;
  memory: number | null;
  memoryTotal: number | null;
  memoryUsed: number | null;
  uptime: number | null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const rows = await db.select().from(nodes);

    const results = await Promise.allSettled(
      rows.map(async (row): Promise<NodeStats> => {
        const connector = getConnector({
          id: row.id,
          host: row.host,
          port: row.port,
          protocol: row.protocol as "http" | "https",
          connectionMode: row.connectionMode as "direct" | "agent",
          authMethod: row.authMethod as "session" | "noauth" | "agent_key",
          credentials: row.credentials,
          agentToken: row.agentToken,
          agentPort: row.agentPort ?? 9191,
          agentTls: row.agentTls ?? false,
        });

        const info = await connector.getSystemInfo();
        return {
          nodeId: row.id,
          cpu: info.cpu,
          cpuCount: info.cpuCount,
          memory: info.memory,
          memoryTotal: info.memoryTotal,
          memoryUsed: info.memoryUsed,
          uptime: info.uptime,
        };
      })
    );

    const stats: NodeStats[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        nodeId: rows[i].id,
        cpu: null,
        cpuCount: null,
        memory: null,
        memoryTotal: null,
        memoryUsed: null,
        uptime: null,
      };
    });

    return Response.json({ success: true, data: stats });
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { getNode, getNodeConnector } from "@/lib/services/node.service";
import { logAudit } from "@/lib/services/audit.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { nodeIds, ...operationData } = body;

    if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
      return Response.json(
        { success: false, error: "nodeIds array is required" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const action = pathParts.slice(-2).join("/");

    const results = await Promise.allSettled(
      nodeIds.map(async (nodeId: string) => {
        const node = await getNode(nodeId);
        const row = await db
          .select()
          .from(nodes)
          .where(eq(nodes.id, nodeId))
          .limit(1);
        if (row.length === 0) throw new NotFoundError("Node", nodeId);

        const connector = getNodeConnector(node, row[0].credentials);

        return { nodeId, nodeName: node.name, connector };
      })
    );

    const data = results.map((result, i) => {
      if (result.status === "rejected") {
        return {
          nodeId: nodeIds[i],
          nodeName: nodeIds[i],
          success: false,
          error: result.reason?.message || "Failed to connect",
        };
      }
      return {
        nodeId: result.value.nodeId,
        nodeName: result.value.nodeName,
        success: true,
      };
    });

    await logAudit(
      `bulk.${action}`,
      "system",
      null,
      null,
      { nodeIds, operationData, results: data },
      data.every((d) => d.success) ? "success" : "failure"
    );

    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

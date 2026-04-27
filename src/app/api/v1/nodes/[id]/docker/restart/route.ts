import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { getNode, getNodeConnector } from "@/lib/services/node.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const NOT_SUPPORTED_MESSAGE =
  "Docker management not available for direct-mode nodes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    if (connector.supportsDocker?.() === false || !connector.dockerRestart) {
      throw new ValidationError(NOT_SUPPORTED_MESSAGE);
    }

    await connector.dockerRestart();
    return Response.json({ success: true, message: "Docker restarted" });
  } catch (error) {
    return errorResponse(error);
  }
}

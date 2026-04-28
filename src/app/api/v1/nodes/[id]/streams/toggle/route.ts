export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { getNode, getNodeConnector } from "@/lib/services/node.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const { streamId, running } = (await request.json()) as {
      streamId?: string;
      running?: boolean;
    };

    if (!streamId) {
      throw new ValidationError("streamId is required");
    }

    if (typeof running !== "boolean") {
      throw new ValidationError("running must be a boolean");
    }

    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    if (running) {
      await connector.stopStreamProxy(streamId);
    } else {
      await connector.startStreamProxy(streamId);
    }

    return Response.json({ success: true, data: { toggled: true } });
  } catch (error) {
    return errorResponse(error);
  }
}

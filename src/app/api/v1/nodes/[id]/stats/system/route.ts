import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { getNode } from "@/lib/services/node.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getNodeConnector } from "@/lib/services/node.service";
import { NotFoundError } from "@/lib/errors";

export async function GET(
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
    const system = await connector.getSystemInfo();
    return Response.json({ success: true, data: system });
  } catch (error) {
    return errorResponse(error);
  }
}

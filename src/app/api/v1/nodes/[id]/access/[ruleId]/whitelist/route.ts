import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { getNode, getNodeConnector } from "@/lib/services/node.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const addWhitelistSchema = z.object({
  ip: z.string().min(1, "IP/CIDR is required"),
  comment: z.string().optional(),
});

const removeWhitelistSchema = z.object({
  ip: z.string().min(1, "IP/CIDR is required"),
});

async function getConnectorForNode(nodeId: string) {
  const node = await getNode(nodeId);
  const row = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", nodeId);
  return getNodeConnector(node, row[0].credentials);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    await requireAuth(request);
    const { id, ruleId } = await params;
    const connector = await getConnectorForNode(id);
    const entries = await connector.getWhitelist(ruleId);
    return Response.json({ success: true, data: entries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    await requireAuth(request);
    const { id, ruleId } = await params;
    const body = await request.json();
    const input = addWhitelistSchema.parse(body);

    const connector = await getConnectorForNode(id);
    await connector.addWhitelist(ruleId, input.ip, input.comment ?? "");

    return Response.json(
      { success: true, message: "IP added to whitelist" },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    await requireAuth(request);
    const { id, ruleId } = await params;
    const body = await request.json();
    const input = removeWhitelistSchema.parse(body);

    const connector = await getConnectorForNode(id);
    await connector.removeWhitelist(ruleId, input.ip);

    return Response.json({ success: true, message: "IP removed from whitelist" });
  } catch (error) {
    return errorResponse(error);
  }
}

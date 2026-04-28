export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { getNode, updateNode, deleteNode } from "@/lib/services/node.service";
import { nodeUpdateSchema } from "@/lib/validators/node";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const node = await getNode(id);
    return Response.json({ success: true, data: node });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = nodeUpdateSchema.parse(body);
    const node = await updateNode(id, input);
    return Response.json({ success: true, data: node });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    await deleteNode(id);
    return Response.json({ success: true, message: "Node deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

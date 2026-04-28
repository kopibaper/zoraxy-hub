export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { listNodes, createNode } from "@/lib/services/node.service";
import { nodeCreateSchema } from "@/lib/validators/node";
import { initializeDatabase } from "@/lib/db";

initializeDatabase();

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const allNodes = await listNodes();
    return Response.json({ success: true, data: allNodes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const input = nodeCreateSchema.parse(body);
    const node = await createNode(input);
    return Response.json({ success: true, data: node }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

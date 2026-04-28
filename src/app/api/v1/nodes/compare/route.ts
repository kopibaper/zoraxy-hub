export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { compareNodes } from "@/lib/services/sync.service";
import { compareNodesSchema } from "@/lib/validators/sync";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const input = compareNodesSchema.parse(body);
    const diff = await compareNodes(input.sourceNodeId, input.targetNodeId);
    return NextResponse.json({ success: true, data: diff });
  } catch (error) {
    return errorResponse(error);
  }
}

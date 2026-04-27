import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { getNodeHealth } from "@/lib/services/node.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const health = await getNodeHealth(id);
    return Response.json({ success: true, data: health });
  } catch (error) {
    return errorResponse(error);
  }
}

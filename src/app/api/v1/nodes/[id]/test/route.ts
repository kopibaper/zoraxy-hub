export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { testNodeConnection } from "@/lib/services/node.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const connected = await testNodeConnection(id);
    return Response.json({
      success: true,
      data: { connected, testedAt: new Date().toISOString() },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

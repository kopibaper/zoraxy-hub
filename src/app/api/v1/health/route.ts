import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { checkAllNodesHealth } from "@/lib/services/health.service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const results = await checkAllNodesHealth();
    return Response.json({ success: true, data: results });
  } catch (error) {
    return errorResponse(error);
  }
}

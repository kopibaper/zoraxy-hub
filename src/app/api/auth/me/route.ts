import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return Response.json({ success: true, data: user });
  } catch (error) {
    return errorResponse(error);
  }
}

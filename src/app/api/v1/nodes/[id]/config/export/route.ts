import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { exportNodeConfig } from "@/lib/services/sync.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const config = await exportNodeConfig(id);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return errorResponse(error);
  }
}

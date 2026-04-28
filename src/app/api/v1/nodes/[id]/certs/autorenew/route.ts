export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { getAutoRenewDomains } from "@/lib/services/cert.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const domains = await getAutoRenewDomains(id);
    return Response.json({ success: true, data: domains });
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { toggleProxyRule } from "@/lib/services/proxy.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();

    if (typeof body.enabled !== "boolean") {
      throw new ValidationError("'enabled' must be a boolean");
    }

    await toggleProxyRule(id, decodeURIComponent(domain), body.enabled);
    return Response.json({ success: true, message: "Proxy rule toggled" });
  } catch (error) {
    return errorResponse(error);
  }
}

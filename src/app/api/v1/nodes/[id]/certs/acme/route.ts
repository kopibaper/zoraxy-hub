export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { obtainACME } from "@/lib/services/cert.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    if (!body.domains || !Array.isArray(body.domains) || body.domains.length === 0) {
      throw new ValidationError("domains array is required and must not be empty");
    }
    if (!body.email) {
      throw new ValidationError("email is required");
    }

    await obtainACME(id, body.domains, body.email);
    return Response.json({
      success: true,
      message: "ACME certificate request submitted",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

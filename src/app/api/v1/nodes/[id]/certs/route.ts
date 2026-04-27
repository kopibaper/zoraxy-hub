import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { listCerts, uploadCert, deleteCert } from "@/lib/services/cert.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const certs = await listCerts(id);
    return Response.json({ success: true, data: certs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    if (!body.domain || !body.certPem || !body.keyPem) {
      throw new ValidationError("domain, certPem, and keyPem are required");
    }

    await uploadCert(id, body.domain, body.certPem, body.keyPem);
    return Response.json(
      { success: true, message: "Certificate uploaded" },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    if (!body.domain) {
      throw new ValidationError("domain is required");
    }

    await deleteCert(id, body.domain);
    return Response.json({ success: true, message: "Certificate deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

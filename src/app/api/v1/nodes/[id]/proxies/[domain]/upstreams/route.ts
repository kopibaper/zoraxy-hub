import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  listUpstreams,
  addUpstream,
  removeUpstream,
} from "@/lib/services/proxy.service";
import { upstreamAddSchema, upstreamRemoveSchema } from "@/lib/validators/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const upstreams = await listUpstreams(id, decodeURIComponent(domain));
    return Response.json({ success: true, data: upstreams });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();
    const input = upstreamAddSchema.parse(body);
    await addUpstream(
      id,
      decodeURIComponent(domain),
      input.origin,
      input.requireTLS,
      input.skipCertValidation,
      input.weight
    );
    return Response.json(
      { success: true, message: "Upstream added" },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();
    const input = upstreamRemoveSchema.parse(body);
    await removeUpstream(id, decodeURIComponent(domain), input.origin);
    return Response.json({ success: true, message: "Upstream removed" });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  getProxyDetail,
  editProxyRule,
  deleteProxyRule,
} from "@/lib/services/proxy.service";
import { proxyRuleUpdateSchema } from "@/lib/validators/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const detail = await getProxyDetail(id, decodeURIComponent(domain));
    return Response.json({ success: true, data: detail });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();
    const input = proxyRuleUpdateSchema.parse(body);
    await editProxyRule(id, decodeURIComponent(domain), input);
    return Response.json({ success: true, message: "Proxy rule updated" });
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
    await deleteProxyRule(id, decodeURIComponent(domain));
    return Response.json({ success: true, message: "Proxy rule deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

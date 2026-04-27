import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { cloneNodeConfig } from "@/lib/services/sync.service";
import { cloneNodeConfigSchema } from "@/lib/validators/sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = cloneNodeConfigSchema.parse(body);

    const result = await cloneNodeConfig(input.sourceNodeId, id, {
      proxyRules: input.proxyRules,
      certs: input.certs,
      streams: input.streams,
      redirects: input.redirects,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

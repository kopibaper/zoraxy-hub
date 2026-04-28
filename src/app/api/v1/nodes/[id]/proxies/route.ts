export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  listProxyRules,
  addProxyRule,
  editProxyRule,
} from "@/lib/services/proxy.service";
import { proxyRuleCreateSchema } from "@/lib/validators/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const rules = await listProxyRules(id);
    return Response.json({ success: true, data: rules });
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
    const input = proxyRuleCreateSchema.parse(body);
    await addProxyRule(
      id,
      input.proxyType,
      input.rootOrMatchingDomain,
      input.origin,
      input.requireTLS
    );

    const updates: Record<string, unknown> = {};
    if (input.skipCertValidation) {
      updates.skipCertValidation = input.skipCertValidation;
    }
    if (input.tags.length > 0) {
      updates.tags = input.tags;
    }
    if (input.useStickySession) {
      updates.useStickySession = input.useStickySession;
    }
    if (input.useActiveLoadBalance) {
      updates.useActiveLoadBalance = input.useActiveLoadBalance;
    }

    if (Object.keys(updates).length > 0) {
      await editProxyRule(id, input.rootOrMatchingDomain, updates);
    }

    return Response.json(
      { success: true, message: "Proxy rule added" },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

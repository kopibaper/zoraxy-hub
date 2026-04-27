import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  addHeaderRewriteRule,
  deleteHeaderRewriteRule,
} from "@/lib/services/proxy.service";
import {
  headerRuleAddSchema,
  headerRuleDeleteSchema,
} from "@/lib/validators/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();
    const input = headerRuleAddSchema.parse(body);
    await addHeaderRewriteRule(
      id,
      decodeURIComponent(domain),
      input.direction,
      input.key,
      input.value,
      input.isRemove
    );
    return Response.json(
      { success: true, message: "Header rewrite rule added" },
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
    const input = headerRuleDeleteSchema.parse(body);
    await deleteHeaderRewriteRule(
      id,
      decodeURIComponent(domain),
      input.direction,
      input.key
    );
    return Response.json({ success: true, message: "Header rewrite rule deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

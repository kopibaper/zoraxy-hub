export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { listTemplates, createTemplate } from "@/lib/services/template.service";
import { templateCreateSchema } from "@/lib/validators/template";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const templates = await listTemplates();
    return Response.json({ success: true, data: templates });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const input = templateCreateSchema.parse(body);
    const template = await createTemplate(input);
    return Response.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

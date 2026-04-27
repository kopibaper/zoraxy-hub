import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/services/template.service";
import { templateUpdateSchema } from "@/lib/validators/template";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const template = await getTemplate(id);
    return Response.json({ success: true, data: template });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = templateUpdateSchema.parse(body);
    const template = await updateTemplate(id, input);
    return Response.json({ success: true, data: template });
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
    await deleteTemplate(id);
    return Response.json({ success: true, message: "Template deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

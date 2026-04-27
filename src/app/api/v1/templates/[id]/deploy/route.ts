import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { deployTemplate, getDeployments } from "@/lib/services/template.service";
import { templateDeploySchema } from "@/lib/validators/template";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = templateDeploySchema.parse(body);
    const deployments = await deployTemplate(id, input);
    return Response.json({ success: true, data: deployments }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const deployments = await getDeployments(id);
    return Response.json({ success: true, data: deployments });
  } catch (error) {
    return errorResponse(error);
  }
}

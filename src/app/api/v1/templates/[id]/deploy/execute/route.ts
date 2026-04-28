export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getTemplate, deployTemplate } from "@/lib/services/template.service";
import { validateVariables } from "@/lib/services/template-engine";

const deployExecuteSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1),
  variables: z.record(z.string(), z.string()).default({}),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = deployExecuteSchema.parse(body);

    const template = await getTemplate(id);
    const check = validateVariables(template.config, input.variables);
    if (!check.valid) {
      throw new ValidationError(`Missing template variables: ${check.missing.join(", ")}`);
    }

    const deployments = await deployTemplate(id, input);
    const results = deployments.map((deployment) => ({
      nodeId: deployment.nodeId,
      success: deployment.status === "deployed",
      status: deployment.status,
      error: deployment.error,
      deployedAt: deployment.deployedAt,
      deploymentId: deployment.id,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          templateId: id,
          results,
          deployments,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

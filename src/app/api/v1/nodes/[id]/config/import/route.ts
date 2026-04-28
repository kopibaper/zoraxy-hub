export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { importNodeConfig } from "@/lib/services/sync.service";
import { importNodeConfigSchema } from "@/lib/validators/sync";
import type { NodeConfig } from "@/lib/services/sync.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const input = importNodeConfigSchema.parse(body);

    const result = await importNodeConfig(id, input.config as unknown as NodeConfig, {
      overwrite: input.overwrite,
      skipExisting: input.skipExisting,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

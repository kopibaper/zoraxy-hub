import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  addVirtualDirectory,
  deleteVirtualDirectory,
} from "@/lib/services/proxy.service";
import {
  virtualDirectoryAddSchema,
  virtualDirectoryDeleteSchema,
} from "@/lib/validators/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domain: string }> }
) {
  try {
    await requireAuth(request);
    const { id, domain } = await params;
    const body = await request.json();
    const input = virtualDirectoryAddSchema.parse(body);
    await addVirtualDirectory(
      id,
      decodeURIComponent(domain),
      input.matchingPath,
      input.domain,
      input.requireTLS,
      input.skipCertValidation
    );
    return Response.json(
      { success: true, message: "Virtual directory added" },
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
    const input = virtualDirectoryDeleteSchema.parse(body);
    await deleteVirtualDirectory(id, decodeURIComponent(domain), input.matchingPath);
    return Response.json({ success: true, message: "Virtual directory deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

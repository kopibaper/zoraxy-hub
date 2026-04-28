export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { getAuditLogs } from "@/lib/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
    const entityType = url.searchParams.get("entityType") as
      | "node"
      | "proxy"
      | "cert"
      | "template"
      | "system"
      | null;
    const nodeId = url.searchParams.get("nodeId");
    const action = url.searchParams.get("action");

    const result = await getAuditLogs({
      page,
      pageSize,
      entityType: entityType || undefined,
      nodeId: nodeId || undefined,
      action: action || undefined,
    });

    return Response.json({
      success: true,
      data: result.entries,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

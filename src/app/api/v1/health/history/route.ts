import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
import { nodeSnapshots } from "@/lib/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const nodeId = url.searchParams.get("nodeId") || undefined;
    const since = url.searchParams.get("since") || undefined;
    const limitRaw = Number.parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 50;

    const filters = [];
    if (nodeId) {
      filters.push(eq(nodeSnapshots.nodeId, nodeId));
    }
    if (since) {
      filters.push(gte(nodeSnapshots.createdAt, since));
    }

    const rows = await db
      .select()
      .from(nodeSnapshots)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(nodeSnapshots.createdAt))
      .limit(limit);

    const snapshots = rows.map((row) => {
      let parsedData: unknown = null;
      try {
        parsedData = JSON.parse(row.data);
      } catch {
        parsedData = null;
      }

      return {
        ...row,
        data: parsedData,
      };
    });

    return Response.json({ success: true, data: snapshots });
  } catch (error) {
    return errorResponse(error);
  }
}

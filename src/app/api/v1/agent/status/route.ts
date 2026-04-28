export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const agentNodes = await db
      .select()
      .from(nodes)
      .where(eq(nodes.connectionMode, "agent"));

    const results = await Promise.allSettled(
      agentNodes.map(async (node) => {
        const protocol = node.agentTls ? "https" : "http";
        const port = node.agentPort ?? 9191;
        const url = `${protocol}://${node.host}:${port}/api/v1/ping`;

        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          const data = await res.json();

          return {
            nodeId: node.id,
            name: node.name,
            connected: data.ok === true,
            agentVersion: data.data?.version,
          };
        } catch {
          return {
            nodeId: node.id,
            name: node.name,
            connected: false,
          };
        }
      })
    );

    const agents = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { nodeId: "unknown", connected: false }
    );

    return Response.json({ success: true, data: agents });
  } catch (error) {
    return errorResponse(error);
  }
}

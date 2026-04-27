import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { getNode, getNodeConnector } from "@/lib/services/node.service";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    const redirects = await connector.listRedirects();
    return Response.json({ success: true, data: redirects });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = (await request.json()) as {
      redirectUrl?: string;
      destUrl?: string;
      statusCode?: number;
      forwardChildpath?: boolean;
    };

    if (!body.redirectUrl) {
      throw new ValidationError("redirectUrl is required");
    }
    if (!body.destUrl) {
      throw new ValidationError("destUrl is required");
    }

    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    await connector.addRedirect(
      body.redirectUrl,
      body.destUrl,
      body.statusCode ?? 302
    );

    if (body.forwardChildpath) {
      const redirects = (await connector.listRedirects()) as Array<{
        ID: string;
        RedirectURL: string;
        DestURL: string;
      }>;

      const created = redirects.find(
        (r) =>
          r.RedirectURL === body.redirectUrl &&
          r.DestURL === body.destUrl
      );

      if (created) {
        await connector.editRedirect(
          created.ID,
          body.redirectUrl,
          body.destUrl,
          body.statusCode ?? 302,
          true
        );
      }
    }

    return Response.json(
      { success: true, message: "Redirect added" },
      { status: 201 }
    );
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
    const body = (await request.json()) as {
      id?: string;
      redirectUrl?: string;
      destUrl?: string;
      statusCode?: number;
      forwardChildpath?: boolean;
    };

    if (!body.id) {
      throw new ValidationError("id is required");
    }
    if (!body.redirectUrl) {
      throw new ValidationError("redirectUrl is required");
    }
    if (!body.destUrl) {
      throw new ValidationError("destUrl is required");
    }

    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    await connector.editRedirect(
      body.id,
      body.redirectUrl,
      body.destUrl,
      body.statusCode ?? 302,
      body.forwardChildpath ?? false
    );

    return Response.json({ success: true, message: "Redirect updated" });
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
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      throw new ValidationError("id is required");
    }

    const node = await getNode(id);
    const row = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (row.length === 0) throw new NotFoundError("Node", id);

    const connector = getNodeConnector(node, row[0].credentials);
    await connector.deleteRedirect(body.id);

    return Response.json({ success: true, message: "Redirect removed" });
  } catch (error) {
    return errorResponse(error);
  }
}

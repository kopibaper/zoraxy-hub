import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { DirectConnector } from "@/lib/connectors/direct";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const { host, port, protocol, authMethod, username, password } = body;

    if (!host) throw new ValidationError("host is required");

    if (body.connectionMode === "agent") {
      const { AgentConnector } = await import("@/lib/connectors/agent");
      const agentProtocol = body.agentTls ? "https" : "http";
      const agentPort = body.agentPort || 9191;
      const agentUrl = `${agentProtocol}://${body.host}:${agentPort}`;
      const connector = new AgentConnector(agentUrl, body.agentToken || "");
      const connected = await connector.testConnection();

      return Response.json({
        success: true,
        data: { connected, testedAt: new Date().toISOString() },
      });
    }

    const noauth = authMethod === "noauth";
    const connector = new DirectConnector(
      host,
      port ?? 8000,
      protocol ?? "https",
      noauth ? undefined : username,
      noauth ? undefined : password,
      noauth
    );

    const connected = await connector.testConnection();

    return Response.json({
      success: true,
      data: { connected, testedAt: new Date().toISOString() },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

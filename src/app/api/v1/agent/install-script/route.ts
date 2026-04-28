import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";

const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/kopibaper/zoraxy-hub/main/agent-go/online-install.sh";

interface InstallScriptInput {
  apiKey: string;
  agentPort?: number;
  listenAddr?: string;
  zoraxyHost?: string;
  zoraxyPort?: number;
  zoraxyUser?: string;
  zoraxyPass?: string;
  zoraxyDataDir?: string;
  dockerEnabled?: boolean;
  dockerContainer?: string;
  version?: string;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body: InstallScriptInput = await request.json();

    if (!body.apiKey || body.apiKey.length < 16) {
      throw new ValidationError(
        "API key is required and must be at least 16 characters"
      );
    }

    const flags: string[] = [];

    flags.push(`--api-key "${body.apiKey}"`);

    if (body.agentPort && body.agentPort !== 9191) {
      flags.push(`--agent-port ${body.agentPort}`);
    }
    if (body.listenAddr && body.listenAddr !== "0.0.0.0") {
      flags.push(`--listen-addr "${body.listenAddr}"`);
    }
    if (body.zoraxyHost && body.zoraxyHost !== "localhost") {
      flags.push(`--zoraxy-host "${body.zoraxyHost}"`);
    }
    if (body.zoraxyPort && body.zoraxyPort !== 8000) {
      flags.push(`--zoraxy-port ${body.zoraxyPort}`);
    }
    if (body.zoraxyUser && body.zoraxyUser !== "admin") {
      flags.push(`--zoraxy-user "${body.zoraxyUser}"`);
    }
    if (body.zoraxyPass && body.zoraxyPass !== "password") {
      flags.push(`--zoraxy-pass "${body.zoraxyPass}"`);
    }
    if (body.zoraxyDataDir && body.zoraxyDataDir !== "/opt/zoraxy") {
      flags.push(`--zoraxy-data "${body.zoraxyDataDir}"`);
    }
    if (body.dockerEnabled) {
      if (body.dockerContainer && body.dockerContainer !== "zoraxy") {
        flags.push(`--docker-name "${body.dockerContainer}"`);
      } else {
        flags.push("--docker");
      }
    }
    if (body.version && body.version !== "latest") {
      flags.push(`--version "${body.version}"`);
    }

    const agentPort = body.agentPort ?? 9191;
    const flagStr = flags.join(" \\\n    ");
    const ufwCmd = `sudo ufw allow ${agentPort}/tcp comment "ZoraxyHub Agent" 2>/dev/null || true`;
    const oneLineCommand = `curl -fsSL ${INSTALL_SCRIPT_URL} | sudo bash -s -- ${flags.join(" ")} && ${ufwCmd}`;
    const multiLineCommand = `curl -fsSL ${INSTALL_SCRIPT_URL} | sudo bash -s -- \\\n    ${flagStr}\n\n# Allow agent port through firewall\n${ufwCmd}`;

    return Response.json({
      success: true,
      data: {
        oneLiner: oneLineCommand,
        multiLine: multiLineCommand,
        scriptUrl: INSTALL_SCRIPT_URL,
        flags,
        config: {
          apiKey: body.apiKey,
          agentPort: body.agentPort ?? 9191,
          listenAddr: body.listenAddr ?? "0.0.0.0",
          zoraxyHost: body.zoraxyHost ?? "localhost",
          zoraxyPort: body.zoraxyPort ?? 8000,
          zoraxyUser: body.zoraxyUser ?? "admin",
          zoraxyDataDir: body.zoraxyDataDir ?? "/opt/zoraxy",
          dockerEnabled: body.dockerEnabled ?? false,
          dockerContainer: body.dockerContainer ?? "zoraxy",
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/errors";
import {
  getTelegramConfig,
  saveTelegramConfig,
} from "@/lib/services/telegram.service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const config = await getTelegramConfig();

    return Response.json({
      success: true,
      data: {
        ...config,
        botToken: config.botToken ? maskToken(config.botToken) : "",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const config = await saveTelegramConfig(body);

    return Response.json({
      success: true,
      data: {
        ...config,
        botToken: config.botToken ? maskToken(config.botToken) : "",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return token.slice(0, 5) + "..." + token.slice(-4);
}

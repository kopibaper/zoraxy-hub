export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, ValidationError } from "@/lib/errors";
import { testTelegramConnection } from "@/lib/services/telegram.service";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const { botToken, chatId } = body;
    if (!botToken || !chatId) {
      throw new ValidationError("Bot token and chat ID are required");
    }

    const result = await testTelegramConnection(botToken, chatId);

    return Response.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

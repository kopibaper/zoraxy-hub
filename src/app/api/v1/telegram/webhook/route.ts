export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import {
  handleWebhookUpdate,
  getTelegramConfig,
} from "@/lib/services/telegram.service";

export async function POST(request: NextRequest) {
  try {
    const config = await getTelegramConfig();
    if (!config.enabled || !config.botToken) {
      return Response.json({ ok: true });
    }

    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    const expectedSecret = config.botToken.split(":").pop() || "";
    if (secretHeader && secretHeader !== expectedSecret) {
      return Response.json({ ok: false }, { status: 403 });
    }

    const update = await request.json();
    await handleWebhookUpdate(update);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
    return Response.json({ ok: true });
  }
}

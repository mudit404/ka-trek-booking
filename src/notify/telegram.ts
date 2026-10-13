import { logger } from "../logger.js";
import type { Notifier } from "./types.js";

/** Logs instead of sending — used when Telegram isn't configured. */
export class ConsoleNotifier implements Notifier {
  async send(message: string): Promise<void> {
    logger.info({ message }, "notify (console)");
  }
}

/**
 * Minimal Telegram Bot API notifier. Good enough for phase 1; the OTP/payment
 * relay (user -> bot) will need long-polling or a webhook on top of this.
 */
export class TelegramNotifier implements Notifier {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
  ) {}

  async send(message: string): Promise<void> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text: message }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, "telegram send failed");
    }
  }
}

export function makeNotifier(env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string }): Notifier {
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    return new TelegramNotifier(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
  }
  return new ConsoleNotifier();
}

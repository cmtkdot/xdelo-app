
/**
 * Environment configuration for the Telegram webhook
 */

interface DenoRuntime {
  env: {
    get(key: string): string | undefined;
  };
}

declare const Deno: DenoRuntime;

// Validate and get Telegram bot token from environment
export const getTelegramBotToken = (): string => {
  if (typeof Deno !== "undefined" && typeof Deno?.env?.get === "function") {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token)
      throw new Error("Missing TELEGRAM_BOT_TOKEN in Deno environment");
    return token;
  }
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable or Deno environment not detected");
};

export const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

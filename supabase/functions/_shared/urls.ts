// URL utility functions for Edge Functions
// @ts-ignore - Allow Deno global
declare const Deno: any;

// Supabase URL from environment variables
function getSupabaseUrl(): string {
  // @ts-ignore - Deno namespace
  return Deno?.env?.get('SUPABASE_URL') || '';
}

// Telegram Bot Token from environment variables
function getTelegramBotToken(): string {
  // @ts-ignore - Deno namespace
  return Deno?.env?.get('TELEGRAM_BOT_TOKEN') || '';
}

/**
 * Gets the public storage URL for a given storage path
 */
export function getStoragePublicUrl(storagePath: string): string {
  return `${getSupabaseUrl()}/storage/v1/object/public/telegram-media/${storagePath}`;
}

/**
 * Gets the URL for a Telegram bot API endpoint
 */
export function getTelegramApiUrl(endpoint: string): string {
  return `https://api.telegram.org/bot${getTelegramBotToken()}/${endpoint}`;
}

/**
 * Gets the URL for downloading a Telegram file
 */
export function getTelegramFileUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${getTelegramBotToken()}/${filePath}`;
}

/**
 * Gets the URL for a Supabase function
 */
export function getSupabaseFunctionUrl(functionName: string): string {
  return `${getSupabaseUrl()}/functions/v1/${functionName}`;
}

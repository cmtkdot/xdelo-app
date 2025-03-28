
/**
 * URL building utilities for Telegram
 */

/**
 * Constructs a URL to a specific Telegram message
 */
export function buildTelegramMessageUrl(chatId: number, messageId: number): string {
  // Remove any negative sign and get the numeric part for the URL
  const chatIdForUrl = Math.abs(chatId).toString();
  // If it was a negative ID (e.g., group/channel), add the c/ prefix for the URL
  const prefix = chatId < 0 ? "c/" : "";
  
  return `https://t.me/${prefix}${chatIdForUrl}/${messageId}`;
}

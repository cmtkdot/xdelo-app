/**
 * Consolidated message utilities to centralize common functions
 * used across multiple edge functions.
 */
// Import the shared Supabase client instead of creating a new one
import { supabaseClient } from "./supabase.ts";

/**
 * Checks if a Telegram message is forwarded.
 * @param message The Telegram message object.
 * @returns True if the message is forwarded, false otherwise.
 */
export function isMessageForwarded(message: any): boolean {
  return !!(
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_sender_name ||
    message.forward_date
  );
}

/**
 * Construct a shareable message URL for a Telegram message
 */
export function constructTelegramMessageUrl(
  chatId: number,
  messageId: number
): string | undefined {
  try {
    // Private chats don't have shareable URLs
    if (chatId > 0) {
      return undefined;
    }

    // Format the chat ID based on its pattern
    let formattedChatId: string;
    if (chatId.toString().startsWith('-100')) {
      // For supergroups/channels
      formattedChatId = chatId.toString().substring(4);
    } else if (chatId < 0) {
      // For regular groups
      formattedChatId = Math.abs(chatId).toString();
    } else {
      // Default case
      formattedChatId = chatId.toString();
    }

    return `https://t.me/c/${formattedChatId}/${messageId}`;
  } catch (error) {
    console.error('Error constructing Telegram URL:', error);
    return undefined;
  }
}

/**
 * Unified function to log processing events
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
  errorMessage?: string
): Promise<void> {
  try {
    // Ensure correlation ID is valid
    const validCorrelationId =
      correlationId &&
      typeof correlationId === 'string' &&
      correlationId.length > 8 ?
      correlationId :
      crypto.randomUUID().toString();

    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: validCorrelationId,
      logged_from: 'edge_function'
    };

    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: validCorrelationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

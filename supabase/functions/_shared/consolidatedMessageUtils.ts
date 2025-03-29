
import { supabaseClient } from "./supabase.ts";

/**
 * Log a processing event to the audit log table
 * 
 * @param eventType The type of event being logged
 * @param entityId The ID of the entity being processed
 * @param correlationId Optional correlation ID for tracing
 * @param metadata Optional metadata to include with the log
 * @param errorMessage Optional error message if the event failed
 */
export async function logProcessingEvent(
  eventType: string,
  entityId?: string,
  correlationId?: string,
  metadata?: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  try {
    // Create a standardized log entry
    const logEntry = {
      event_type: eventType,
      entity_id: entityId || null,
      correlation_id: correlationId || crypto.randomUUID().toString(),
      metadata: metadata || {},
      error_message: errorMessage || null,
      event_timestamp: new Date().toISOString()
    };

    // Log to the database
    await supabaseClient
      .from('unified_audit_logs')
      .insert(logEntry);
      
    // Also log to console for debugging
    console.log(`[AUDIT] ${eventType}`, {
      entity_id: entityId,
      correlation_id: correlationId,
      error: errorMessage
    });
    
  } catch (error) {
    // Log to console if database logging fails
    console.error(`Failed to log processing event: ${error instanceof Error ? error.message : String(error)}`, {
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId
    });
  }
}

/**
 * Log an error event with enhanced error details
 */
export async function logErrorEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  error: unknown,
  metadata: Record<string, any> = {}
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const enhancedMetadata = {
    ...metadata,
    error_type: typeof error,
    error_stack: errorStack,
  };
  
  await logProcessingEvent(eventType, entityId, correlationId, enhancedMetadata, errorMessage);
}

/**
 * Construct a Telegram message URL from chat ID and message ID
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

// Re-export the supabaseClient for convenience
export { supabaseClient };

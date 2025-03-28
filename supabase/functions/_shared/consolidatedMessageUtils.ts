
/**
 * Consolidated message utilities to centralize common functions
 * used across multiple edge functions.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Create Supabase client with improved configuration
export const createSupabaseClient = (
  options: { 
    timeoutSeconds?: number;
    retryAttempts?: number;
  } = {}
) => {
  const { timeoutSeconds = 15, retryAttempts = 3 } = options;
  
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'x-statement-timeout': `${timeoutSeconds * 1000}`, // Convert to milliseconds
        },
      },
      db: {
        schema: 'public',
      }
    }
  );
};

// Create a default supabase client instance for easy imports
export const supabaseClient = createSupabaseClient();

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

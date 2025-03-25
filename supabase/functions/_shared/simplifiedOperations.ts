
import { createSupabaseClient } from "./supabase.ts";
import { EdgeLogger } from "./simpleLogger.ts";

/**
 * Simplified logging function that ensures UUID validity
 */
export async function logEvent(
  logger: EdgeLogger,
  eventType: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    
    // Generate a valid UUID (required for database)
    const safeId = crypto.randomUUID();
    
    // Call the database function with the safe ID
    await supabase.rpc('xdelo_logprocessingevent', {
      p_event_type: eventType,
      p_entity_id: safeId,
      p_correlation_id: logger.getCorrelationId(),
      p_metadata: {
        ...metadata,
        original_entity_id: entityId,
        logged_at: new Date().toISOString(),
        source: 'edge_function'
      }
    });
    
    // Also log to console for debugging
    logger.info(`Logged ${eventType}`, { 
      entity_id: entityId, 
      safe_id: safeId
    });
  } catch (error) {
    // Log error but continue execution
    logger.error(`Failed to log ${eventType}`, error);
  }
}

/**
 * Create a message with minimal logging overhead
 */
export async function createMessage(
  messageData: Record<string, any>,
  logger: EdgeLogger
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseClient();
    
    // Insert the new message
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();
    
    if (error) throw error;
    
    // Log success with minimal detail
    logger.info(`Created message ${data.id}`, {
      telegram_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id
    });
    
    return { id: data.id, success: true };
  } catch (error) {
    logger.error('Failed to create message', error);
    return { 
      id: '', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}


import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ProcessingState } from "../../_shared/types.ts";
import { NonMediaMessage, MessageResponse, LoggerInterface } from "./types.ts";
import { logMessageEvent } from "./auditLogger.ts";

/**
 * Create a non-media message record in the database
 */
export async function createNonMediaMessage(
  supabase: SupabaseClient,
  messageData: Omit<NonMediaMessage, 'id' | 'created_at' | 'updated_at'>,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Ensure correlation_id is stored as string
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID().toString();
    
    logger.info?.('Creating non-media message with correlation_id', { 
      correlation_id: correlationId,
      message_type: messageData.message_type
    });

    const messageDataWithTimestamps = {
      ...messageData,
      correlation_id: correlationId,
      processing_state: 'pending' as ProcessingState,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('other_messages')
      .insert(messageDataWithTimestamps)
      .select('id')
      .single();

    if (error) throw error;

    const messageId = data.id;

    // Log message creation
    await logMessageEvent(supabase, 'non_media_message_created', {
      entity_id: messageId,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: messageDataWithTimestamps,
      metadata: {
        message_type: messageData.message_type,
        correlation_id: correlationId
      }
    });

    return { id: messageId, success: true };
  } catch (error) {
    logger.error('Error creating non-media message:', error);
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'NON_MEDIA_INSERT_ERROR'
    };
  }
}


import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { MediaMessage, MessageResponse, UpdateProcessingStateParams, LoggerInterface } from "./types.ts";
import { logMessageEvent } from "./auditLogger.ts";

/**
 * Update an existing message in the database
 */
export async function updateMessage(
  supabase: SupabaseClient,
  chatId: number,
  messageId: number,
  updateData: Partial<MediaMessage>,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Remove public_url if it's in the update data
    if ('public_url' in updateData) {
      delete updateData.public_url;
    }
    
    // Log the start of update operation
    logger.info?.('Updating message', {
      chat_id: chatId,
      telegram_message_id: messageId,
      update_keys: Object.keys(updateData)
    });

    // Get existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId)
      .single();

    if (fetchError || !existingMessage) {
      throw new Error(fetchError?.message || 'Message not found');
    }

    // Handle analyzed_content history
    let old_analyzed_content = existingMessage.old_analyzed_content || [];
    if (existingMessage.analyzed_content) {
      old_analyzed_content = [...old_analyzed_content, existingMessage.analyzed_content];
    }

    // Prepare update data
    const updateWithTimestamp = {
      ...updateData,
      old_analyzed_content,
      updated_at: new Date().toISOString(),
      edit_count: (existingMessage.edit_count || 0) + 1
    };

    // Update message
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateWithTimestamp)
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId);

    if (updateError) throw updateError;

    // Log update event
    await logMessageEvent(supabase, 'message_updated', {
      entity_id: existingMessage.id,
      telegram_message_id: messageId,
      chat_id: chatId,
      previous_state: existingMessage,
      new_state: updateData,
      metadata: {
        media_group_id: existingMessage.media_group_id,
        is_edit: true,
        correlation_id: updateData.correlation_id
      }
    });

    return { id: existingMessage.id, success: true };
  } catch (error) {
    logger.error('Error updating message:', error);
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'MESSAGE_UPDATE_ERROR'
    };
  }
}

/**
 * Update the processing state of a message
 */
export async function updateMessageProcessingState(
  supabase: SupabaseClient,
  params: UpdateProcessingStateParams,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Log state update operation
    logger.info?.('Updating message processing state', {
      message_id: params.messageId,
      new_state: params.state
    });

    // Get existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    if (fetchError || !existingMessage) {
      throw new Error(fetchError?.message || 'Message not found');
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      processing_state: params.state,
      updated_at: new Date().toISOString()
    };

    if (params.analyzedContent) {
      updateData.analyzed_content = params.analyzedContent;
      updateData.processing_completed_at = new Date().toISOString();
    }

    if (params.error) {
      updateData.error_message = params.error;
      updateData.last_error_at = new Date().toISOString();
      updateData.retry_count = (existingMessage.retry_count || 0) + 1;
    }

    if (params.processingStarted) {
      updateData.processing_started_at = new Date().toISOString();
    }

    // Update message state
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', params.messageId);

    if (updateError) throw updateError;

    // Get correlation_id for logging
    const correlationId = existingMessage?.correlation_id ? 
      existingMessage.correlation_id.toString() : 
      null;

    // Log state change
    await logMessageEvent(supabase, 'processing_state_changed', {
      entity_id: params.messageId,
      telegram_message_id: existingMessage?.telegram_message_id,
      chat_id: existingMessage?.chat_id,
      previous_state: { 
        processing_state: existingMessage?.processing_state,
        analyzed_content: existingMessage?.analyzed_content 
      },
      new_state: { 
        processing_state: params.state,
        analyzed_content: params.analyzedContent 
      },
      metadata: {
        error_message: params.error,
        media_group_id: existingMessage?.media_group_id,
        retry_count: updateData.retry_count,
        correlation_id: correlationId
      }
    });

    return { id: params.messageId, success: true };
  } catch (error) {
    if (logger?.error) {
      logger.error('Error updating message processing state:', error);
    } else {
      console.error('Error updating message processing state:', error);
    }
    return { 
      id: params.messageId, 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'PROCESSING_STATE_UPDATE_ERROR'
    };
  }
}

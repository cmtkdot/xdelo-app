// Shared database operations for edge functions
import { createSupabaseClient } from "./supabase.ts";
import { ProcessingState, AnalyzedContent } from "./types.ts";
import { LoggerInterface } from "./logger/adapter.ts";
import { Logger } from "./logger/index.ts";

// Re-export LoggerInterface
export { LoggerInterface } from "./logger/adapter.ts";

interface MessageResponse {
  id: string;
  success: boolean;
  error_message?: string;
  error_code?: string;
}

interface UpdateProcessingStateParams {
  messageId: string;
  state: ProcessingState;
  analyzedContent?: AnalyzedContent;
  error?: string;
  processingStarted?: boolean;
  processingCompleted?: boolean;
}

/**
 * Log a processing event to the audit log using the database function
 * This function ensures proper UUID handling by using the database function
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string | number,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID();
    
    // Convert entityId to string if it's not already
    const entityIdStr = entityId?.toString() || 'system';
    
    // Call the PostgreSQL function that handles UUID validation internally
    await supabase.rpc('xdelo_logprocessingevent', {
      p_event_type: eventType,
      p_entity_id: entityIdStr,
      p_correlation_id: corrId,
      p_metadata: metadata,
      p_error_message: errorMessage
    });
  } catch (e) {
    console.error(`Error logging event: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Create a media message with duplicate detection
 */
export async function xdelo_createMessage(
  messageData: any,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation_id is stored as string
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID();
    
    // Basic validation
    if (!messageData.chat_id || !messageData.telegram_message_id) {
      throw new Error("Missing required fields: chat_id or telegram_message_id");
    }
    
    // Check for existing file if file_unique_id exists
    if (messageData.file_unique_id) {
      const { data: existingFile, error: queryError } = await supabase
        .from('messages')
        .select('id')
        .eq('file_unique_id', messageData.file_unique_id)
        .maybeSingle();
        
      if (queryError) {
        logger.error('Error checking for existing file:', queryError);
        throw queryError;
      }

      if (existingFile) {
        // Log duplicate detection
        await xdelo_logProcessingEvent(
          'duplicate_file_detected',
          existingFile.id,
          correlationId,
          {
            file_unique_id: messageData.file_unique_id,
            telegram_message_id: messageData.telegram_message_id,
            chat_id: messageData.chat_id
          }
        );

        return { 
          id: existingFile.id, 
          success: true,
          error_message: "File already exists in database" 
        };
      }
    }

    // Prepare message data
    const safeMessageData = {
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      chat_type: messageData.chat_type || 'unknown',
      chat_title: messageData.chat_title,
      caption: messageData.caption,
      media_group_id: messageData.media_group_id,
      file_id: messageData.file_id,
      file_unique_id: messageData.file_unique_id,
      mime_type: messageData.mime_type,
      file_size: messageData.file_size,
      width: messageData.width,
      height: messageData.height,
      duration: messageData.duration,
      storage_path: messageData.storage_path,
      public_url: messageData.public_url,
      correlation_id: correlationId,
      processing_state: 'pending' as ProcessingState,
      telegram_data: messageData.telegram_data || {},
      forward_info: messageData.forward_info,
      is_edited_channel_post: messageData.is_edited_channel_post,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_url: messageData.message_url
    };

    // Insert message data
    const { data, error } = await supabase
      .from('messages')
      .insert(safeMessageData)
      .select('id')
      .single();

    if (error) {
      logger.error('Database insert error:', error);
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('No ID returned from insert operation');
    }

    // Log message creation
    await xdelo_logProcessingEvent(
      'message_created',
      data.id,
      correlationId,
      {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        media_group_id: messageData.media_group_id
      }
    );

    return { id: data.id, success: true };
  } catch (error) {
    logger.error('Error creating message:', error);
    
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as any).code : 'DB_INSERT_ERROR'
    };
  }
}

/**
 * Create a non-media message record
 */
export async function xdelo_createNonMediaMessage(
  messageData: any,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation_id is stored as string
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID();
    
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

    // Log message creation
    await xdelo_logProcessingEvent(
      'non_media_message_created',
      data.id,
      correlationId,
      {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        message_type: messageData.message_type
      }
    );

    return { id: data.id, success: true };
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

/**
 * Check if a message already exists - optimized to reduce database calls
 */
export async function xdelo_checkDuplicateFile(
  telegramMessageId?: number,
  chatId?: number,
  fileUniqueId?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    if ((!telegramMessageId || !chatId) && !fileUniqueId) {
      return false;
    }
    
    // Build an optimized query to check for duplicates
    const query = supabase.from('messages').select('id');
    
    if (fileUniqueId) {
      query.eq('file_unique_id', fileUniqueId);
    } else if (telegramMessageId && chatId) {
      query.eq('telegram_message_id', telegramMessageId).eq('chat_id', chatId);
    }
    
    const { data, error } = await query.maybeSingle();
      
    if (error) {
      console.error('Error checking for duplicate:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return false;
  }
}

/**
 * Update an existing message
 */
export async function xdelo_updateMessage(
  chatId: number,
  messageId: number,
  updateData: any,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    const supabase = createSupabaseClient();
    
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
    await xdelo_logProcessingEvent(
      'message_updated',
      existingMessage.id,
      updateData.correlation_id?.toString() || crypto.randomUUID(),
      {
        telegram_message_id: messageId,
        chat_id: chatId
      }
    );

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
 * Update message processing state
 */
export async function xdelo_updateMessageProcessingState(
  params: UpdateProcessingStateParams,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    const supabase = createSupabaseClient();

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

    // Log state change using our new safer logging function
    await xdelo_logProcessingEvent(
      'processing_state_changed',
      params.messageId,
      existingMessage?.correlation_id?.toString() || crypto.randomUUID(),
      {
        telegram_message_id: existingMessage?.telegram_message_id,
        chat_id: existingMessage?.chat_id,
        processing_state: params.state
      }
    );

    return { id: params.messageId, success: true };
  } catch (error) {
    logger.error('Error updating message processing state:', error);
    return { 
      id: params.messageId, 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

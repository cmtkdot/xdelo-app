// Shared database operations for edge functions
import { createSupabaseClient } from "./supabase.ts";
import { SupabaseClient } from "@supabase/supabase-js";
import { ProcessingState, AnalyzedContent } from "./types.ts";

// Logger interface used by database operations - all methods required (not optional)
export interface LoggerInterface {
  error: (message: string, error: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
}

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
 * Log a processing event to the audit log
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
) {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    // Ensure entityId is a valid UUID, if not, generate one and include the original ID in metadata
    let validEntityId: string;
    try {
      // Try to parse as UUID to validate
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (entityId && uuidRegex.test(entityId)) {
        validEntityId = entityId;
      } else {
        // Not a valid UUID, generate one and store original in metadata
        validEntityId = crypto.randomUUID();
        // Add the original ID to metadata
        metadata = {
          ...metadata,
          original_entity_id: entityId
        };
      }
    } catch (e) {
      // Any error, use a new UUID
      validEntityId = crypto.randomUUID();
      metadata = {
        ...metadata,
        original_entity_id: entityId
      };
    }
    
    const { error } = await supabase.from("unified_audit_logs").insert({
      event_type: eventType,
      entity_id: validEntityId,
      correlation_id: corrId,
      metadata: metadata,
      error_message: errorMessage
    });
    
    if (error) {
      console.error(`Error logging event ${eventType}: ${error.message}`, { eventType, entityId: validEntityId });
    }
  } catch (e) {
    console.error(`Exception in logProcessingEvent: ${e.message}`);
  }
}

/**
 * Process a message caption using direct database calls
 */
export async function xdelo_processMessageCaption(
  messageId: string,
  caption?: string,
  correlationId?: string,
  isEdit: boolean = false
) {
  try {
    const supabase = createSupabaseClient();
    
    // Create a new correlation ID if one wasn't provided
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    // Call the database function directly
    const { data, error } = await supabase.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: corrId,
        p_force: isEdit
      }
    );
    
    if (error) {
      throw new Error(`Error processing caption: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error processing caption for message ${messageId}: ${error.message}`);
    
    // Log the error
    await xdelo_logProcessingEvent(
      "caption_processing_failed",
      messageId,
      correlationId || crypto.randomUUID().toString(),
      { error: error.message },
      error.message
    );
    
    throw error;
  }
}

/**
 * Sync analyzed content across all messages in a media group
 */
export async function xdelo_syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
) {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    const { data, error } = await supabase.rpc(
      "xdelo_sync_media_group_content",
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: corrId,
        p_force_sync: true,
        p_sync_edit_history: false
      }
    );
    
    if (error) {
      throw new Error(`Failed to sync media group: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error syncing media group: ${error.message}`);
    throw error;
  }
}

/**
 * Create a media message with duplicate detection based on file_unique_id
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
      crypto.randomUUID().toString();
    
    // Validate required fields
    if (!messageData.file_unique_id) {
      throw new Error("Missing required field: file_unique_id");
    }
    
    if (!messageData.chat_id) {
      throw new Error("Missing required field: chat_id");
    }
    
    if (!messageData.telegram_message_id) {
      throw new Error("Missing required field: telegram_message_id");
    }
    
    if (!messageData.storage_path) {
      throw new Error("Missing required field: storage_path");
    }
    
    if (!messageData.public_url) {
      throw new Error("Missing required field: public_url");
    }
    
    logger.info('Creating message with correlation_id', { 
      correlation_id: correlationId,
      file_unique_id: messageData.file_unique_id
    });

    // First check if a message with this file_unique_id already exists
    // This is our primary duplicate detection mechanism
    if (messageData.file_unique_id) {
      const { data: existingFile, error: queryError } = await supabase
        .from('messages')
        .select('id, file_unique_id, storage_path, telegram_message_id, chat_id, public_url')
        .eq('file_unique_id', messageData.file_unique_id)
        .maybeSingle();
        
      if (queryError) {
        logger.error('Error checking for existing file:', queryError);
        throw new Error(`Database query error: ${queryError.message}`);
      }

      if (existingFile) {
        logger.info('Found existing file with same file_unique_id', { 
          existing_id: existingFile.id,
          file_unique_id: messageData.file_unique_id
        });

        // Log duplicate detection
        await xdelo_logProcessingEvent(
          'duplicate_file_detected',
          existingFile.id,
          correlationId,
          {
            file_unique_id: messageData.file_unique_id,
            existing_message_id: existingFile.id,
            new_telegram_message_id: messageData.telegram_message_id,
            new_chat_id: messageData.chat_id
          }
        );

        return { 
          id: existingFile.id, 
          success: true,
          error_message: "File already exists in database" 
        };
      }
    }

    // Prepare message data with consistent format
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
    
    // Log the data being inserted
    logger.info('Inserting message data', {
      correlation_id: correlationId,
      telegram_message_id: safeMessageData.telegram_message_id,
      chat_id: safeMessageData.chat_id,
      file_unique_id: safeMessageData.file_unique_id,
      storage_path: safeMessageData.storage_path
    });

    // Insert message data directly
    const { data, error } = await supabase
      .from('messages')
      .insert(safeMessageData)
      .select('id')
      .single();

    if (error) {
      // Enhanced error logging
      logger.error('Database insert error:', error);
      
      // Include more diagnostic information
      if (typeof error === 'object') {
        for (const [key, value] of Object.entries(error)) {
          logger.error(`Error detail - ${key}:`, value);
        }
      }
      
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('No ID returned from insert operation');
    }

    const messageId = data.id;

    // Log message creation event
    await xdelo_logProcessingEvent(
      'message_created',
      messageId,
      correlationId,
      {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        new_state: safeMessageData
      }
    );

    return { id: messageId, success: true };
  } catch (error) {
    // Enhanced error logging with better error object handling
    const errorMessage = error instanceof Error 
      ? `${error.message}${error.stack ? ` (${error.stack})` : ''}`
      : (typeof error === 'object' ? JSON.stringify(error) : String(error));
      
    logger.error('Error creating message:', errorMessage);
    
    // Include error object structure for better debugging
    if (typeof error === 'object') {
      logger.error('Error object structure:', {
        type: typeof error,
        constructor: error.constructor?.name,
        keys: Object.keys(error),
        code: 'code' in error ? (error as any).code : undefined,
        message: 'message' in error ? (error as any).message : undefined
      });
    }
    
    // Extract error code with fallback
    const errorCode = error instanceof Error && 'code' in error 
      ? (error as any).code 
      : (typeof error === 'object' && 'code' in error ? (error as any).code : 'DB_INSERT_ERROR');
    
    return { 
      id: '', 
      success: false, 
      error_message: errorMessage,
      error_code: errorCode
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
      crypto.randomUUID().toString();
    
    logger.info('Creating non-media message with correlation_id', { 
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
    await xdelo_logProcessingEvent(
      'non_media_message_created',
      messageId,
      correlationId,
      {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        message_type: messageData.message_type,
        new_state: messageDataWithTimestamps
      }
    );

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
    
    // Remove public_url if it's in the update data
    if ('public_url' in updateData) {
      delete updateData.public_url;
    }
    
    // Log the start of update operation
    logger.info('Updating message', {
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
    await xdelo_logProcessingEvent(
      'message_updated',
      existingMessage.id,
      updateData.correlation_id?.toString() || crypto.randomUUID().toString(),
      {
        telegram_message_id: messageId,
        chat_id: chatId,
        media_group_id: existingMessage.media_group_id,
        is_edit: true,
        previous_state: existingMessage,
        new_state: updateData
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
 * Update the processing state of a message
 */
export async function xdelo_updateMessageProcessingState(
  params: UpdateProcessingStateParams,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    const supabase = createSupabaseClient();
    
    // Log state update operation
    logger.info('Updating message processing state', {
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
      crypto.randomUUID().toString();

    // Log state change
    await xdelo_logProcessingEvent(
      'processing_state_changed',
      params.messageId,
      correlationId,
      {
        telegram_message_id: existingMessage?.telegram_message_id,
        chat_id: existingMessage?.chat_id,
        media_group_id: existingMessage?.media_group_id,
        retry_count: updateData.retry_count,
        previous_state: { 
          processing_state: existingMessage?.processing_state,
          analyzed_content: existingMessage?.analyzed_content 
        },
        new_state: { 
          processing_state: params.state,
          analyzed_content: params.analyzedContent 
        },
        error_message: params.error
      },
      params.error
    );

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

/**
 * Check if a message with this file_unique_id already exists
 * Updated to also allow checking by telegramMessageId and chatId
 */
export async function xdelo_checkDuplicateFile(
  telegramMessageId?: number,
  chatId?: number,
  fileUniqueId?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    // Either both telegramMessageId and chatId must be provided, or fileUniqueId must be provided
    if ((!telegramMessageId || !chatId) && !fileUniqueId) {
      console.warn('Attempted to check for duplicate file without sufficient identifiers');
      return false;
    }
    
    // Build the query based on the provided parameters
    let query = supabase.from('messages').select('id');
    
    if (fileUniqueId) {
      query = query.eq('file_unique_id', fileUniqueId);
    } else if (telegramMessageId && chatId) {
      query = query.eq('telegram_message_id', telegramMessageId).eq('chat_id', chatId);
    }
    
    const { data, error } = await query.maybeSingle();
      
    if (error) {
      console.error('Error checking for duplicate file:', error);
      // Don't throw - we want graceful fallback to creating a new record
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Exception checking for duplicate file:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}

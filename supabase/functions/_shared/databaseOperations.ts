// Shared database operations for edge functions
import { createSupabaseClient } from "./supabase.ts";
import { ProcessingState, AnalyzedContent } from "./types.ts";

// Logger interface used by database operations
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
 * Log a processing event to the audit log with guaranteed UUID format
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
    const corrId = correlationId?.toString() || crypto.randomUUID();
    
    // ALWAYS generate a new UUID to avoid type errors with UUID columns
    const validEntityId = crypto.randomUUID();
    
    // Store original entity ID in metadata
    const enhancedMetadata = {
      ...metadata,
      original_entity_id: entityId
    };
    
    // Insert with guaranteed valid UUID
    const { error } = await supabase.from("unified_audit_logs").insert({
      event_type: eventType,
      entity_id: validEntityId,
      correlation_id: corrId,
      metadata: enhancedMetadata,
      error_message: errorMessage
    });
    
    if (error) {
      console.error(`Error logging event ${eventType}: ${error.message}`);
    }
  } catch (e) {
    console.error(`Exception in logProcessingEvent: ${e instanceof Error ? e.message : String(e)}`);
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

    // Check for existing file
    if (messageData.file_unique_id) {
      const { data: existingFile, error: queryError } = await supabase
        .from('messages')
        .select('id, file_unique_id')
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

    const messageId = data.id;

    // Log message creation
    await xdelo_logProcessingEvent(
      'message_created',
      messageId,
      correlationId,
      {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info
      }
    );

    return { id: messageId, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error creating message:', errorMessage);
    
    return { 
      id: '', 
      success: false, 
      error_message: errorMessage,
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
    
    logger.info('Creating non-media message', { 
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
        message_type: messageData.message_type
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
 * Check if a message already exists
 */
export async function xdelo_checkDuplicateFile(
  telegramMessageId?: number,
  chatId?: number,
  fileUniqueId?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    if ((!telegramMessageId || !chatId) && !fileUniqueId) {
      console.warn('Attempted to check for duplicate without sufficient identifiers');
      return false;
    }
    
    let query = supabase.from('messages').select('id');
    
    if (fileUniqueId) {
      query = query.eq('file_unique_id', fileUniqueId);
    } else if (telegramMessageId && chatId) {
      query = query.eq('telegram_message_id', telegramMessageId).eq('chat_id', chatId);
    }
    
    const { data, error } = await query.maybeSingle();
      
    if (error) {
      console.error('Error checking for duplicate:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Exception checking for duplicate:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}

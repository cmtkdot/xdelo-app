
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ProcessingState } from "../../_shared/types.ts";
import { MessageInput, MessageResponse, UpdateProcessingStateParams, LoggerInterface } from "./types.ts";
import { logMessageEvent } from "./auditLogger.ts";

/**
 * Create a media message with duplicate detection based on file_unique_id
 */
export async function createMessage(
  supabase: SupabaseClient,
  messageData: MessageInput,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
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
    
    logger.info?.('Creating message with correlation_id', { 
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
        logger.info?.('Found existing file with same file_unique_id', { 
          existing_id: existingFile.id,
          file_unique_id: messageData.file_unique_id
        });

        // Log duplicate detection
        await logMessageEvent(supabase, 'duplicate_file_detected', {
          entity_id: existingFile.id,
          telegram_message_id: messageData.telegram_message_id,
          chat_id: messageData.chat_id,
          metadata: {
            file_unique_id: messageData.file_unique_id,
            correlation_id: correlationId,
            existing_message_id: existingFile.id,
            new_telegram_message_id: messageData.telegram_message_id,
            new_chat_id: messageData.chat_id
          }
        });

        return { 
          id: existingFile.id, 
          success: true,
          error_message: "File already exists in database" 
        };
      }
    }

    // Prepare message data with consistent format
    // Use the public_url directly from messageData
    // This will now be properly set by the mediaUtils.ts uploadMediaToStorage function
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
      public_url: messageData.public_url, // Use the URL set by the uploader
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
    logger.info?.('Inserting message data', {
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
    await logMessageEvent(supabase, 'message_created', {
      entity_id: messageId,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: safeMessageData,
      metadata: {
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        correlation_id: correlationId
      }
    });

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

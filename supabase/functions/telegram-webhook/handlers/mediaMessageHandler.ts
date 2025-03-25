import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_validateAndFixStoragePath,
  xdelo_isViewableMimeType,
  xdelo_detectMimeType
} from '../../_shared/mediaUtils.ts';
import {
  xdelo_findExistingFile,
  xdelo_processMessageMedia
} from '../../_shared/mediaUtils.ts';
import { 
  xdelo_logProcessingEvent,
  xdelo_createMessage,
  xdelo_checkDuplicateFile,
  xdelo_updateMessage,
  LoggerInterface
} from '../../_shared/databaseOperations.ts';
import { Logger, createLogger } from '../../_shared/logger/index.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/edgeHandler.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';

// Get Telegram bot token from environment - using environment variable
const TELEGRAM_BOT_TOKEN = globalThis?.process?.env.TELEGRAM_BOT_TOKEN ||
  globalThis?.Deno?.env?.get?.('TELEGRAM_BOT_TOKEN') ||
  '';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

/**
 * Create a logger adapter that implements the LoggerInterface
 * This ensures we always have a valid logger even if the context logger is undefined
 */
function createLoggerAdapter(logger?: Logger): LoggerInterface {
  if (logger) {
    return {
      error: (message: string, error: unknown): void => {
        logger.error(message, error);
      },
      info: (message: string, data?: unknown): void => {
        if (data) {
          logger.info(message, data as Record<string, any>);
        } else {
          logger.info(message);
        }
      },
      warn: (message: string, data?: unknown): void => {
        if (data) {
          logger.warn(message, data as Record<string, any>);
        } else {
          logger.warn(message);
        }
      }
    };
  }
  
  // Fallback to console if no logger is provided
  return {
    error: (message: string, error: unknown): void => console.error(message, error),
    info: (message: string, data?: unknown): void => console.info(message, data),
    warn: (message: string, data?: unknown): void => console.warn(message, data)
  };
}

/**
 * Main handler for media messages from Telegram
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;
    const loggerAdapter = createLoggerAdapter(logger);
    
    // Log the start of processing
    loggerAdapter.info(`Processing ${isEdit ? 'edited' : 'new'} media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    
    let response;
    
    // Route to the appropriate handler based on whether it's an edit
    if (isEdit && previousMessage) {
      response = await xdelo_handleEditedMediaMessage(message, context, previousMessage);
    } else {
      response = await xdelo_handleNewMediaMessage(message, context);
    }
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const loggerAdapter = createLoggerAdapter(context.logger);
    loggerAdapter.error(`Error processing media message: ${errorMessage}`, error);
    
    // Also log to database for tracking
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        crypto.randomUUID().toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: errorMessage
        },
        errorMessage
      );
    } catch (logError) {
      loggerAdapter.error(`Failed to log error to database`, logError);
    }
    
    return createErrorResponse(errorMessage, 500, context.correlationId);
  }
}

/**
 * Helper function to handle edited media messages
 */
async function xdelo_handleEditedMediaMessage(
  message: TelegramMessage, 
  context: MessageContext,
  previousMessage: TelegramMessage
): Promise<Response> {
  const { correlationId, logger } = context;
  const loggerAdapter = createLoggerAdapter(logger);

  // First, look up the existing message
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (lookupError) {
    loggerAdapter.error(`Failed to lookup existing message for edit`, lookupError);
    throw new Error(`Database lookup failed: ${lookupError.message}`);
  }

  if (existingMessage) {
    // Store previous state in edit_history
    let editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      previous_processing_state: existingMessage.processing_state,
      edit_source: 'telegram_edit',
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
    });

    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = message.photo || message.video || message.document;
    
    // If media has been updated, handle the new media
    if (hasNewMedia) {
      try {
        loggerAdapter.info(`Media has changed in edit for message ${message.message_id}`);
        
        // Determine the current file details
        const telegramFile = message.photo ? 
          message.photo[message.photo.length - 1] : 
          (message.video || message.document || null);
          
        if (!telegramFile) {
          throw new Error('No media file found in edited message');
        }
        
        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);
        
        // Process the new media file
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN,
          existingMessage.id // Use existing message ID
        );
        
        if (!mediaProcessResult.success) {
          throw new Error(`Failed to process edited media: ${mediaProcessResult.error}`);
        }
        
        // Prepare update data
        const updateData = {
          caption: message.caption,
          file_id: telegramFile.file_id,
          file_unique_id: telegramFile.file_unique_id,
          mime_type: detectedMimeType,
          width: 'width' in telegramFile ? telegramFile.width : undefined,
          height: 'height' in telegramFile ? telegramFile.height : undefined,
          duration: message.video?.duration,
          file_size: telegramFile.file_size,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          storage_path: mediaProcessResult.fileInfo.storage_path,
          public_url: mediaProcessResult.fileInfo.public_url,
          last_edited_at: new Date().toISOString(),
          correlation_id: correlationId
        };
        
        // Update using shared function
        const result = await xdelo_updateMessage(
          message.chat.id,
          message.message_id,
          updateData,
          loggerAdapter
        );
          
        if (!result.success) {
          throw new Error(`Failed to update message with new media: ${result.error_message}`);
        }
        
        // Log the edit operation
        try {
          await xdelo_logProcessingEvent(
            "message_media_edited",
            existingMessage.id,
            correlationId,
            {
              message_id: message.message_id,
              chat_id: message.chat.id,
              file_id: telegramFile.file_id,
              file_unique_id: telegramFile.file_unique_id,
              storage_path: mediaProcessResult.fileInfo.storage_path
            }
          );
        } catch (logError) {
          loggerAdapter.error(`Failed to log media edit operation`, logError);
        }
      } catch (mediaError) {
        loggerAdapter.error(`Error processing edited media`, mediaError);
        throw mediaError;
      }
    } 
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      loggerAdapter.info(`Caption has changed in edit for message ${message.message_id}`);
      
      // Update data for caption change
      const updateData = {
        caption: message.caption,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_count: (existingMessage.edit_count || 0) + 1,
        edit_history: editHistory,
        processing_state: message.caption ? 'pending' : existingMessage.processing_state,
        last_edited_at: new Date().toISOString(),
        correlation_id: correlationId
      };
      
      // Update using shared function
      const result = await xdelo_updateMessage(
        message.chat.id,
        message.message_id,
        updateData,
        loggerAdapter
      );
        
      if (!result.success) {
        throw new Error(`Failed to update message caption: ${result.error_message}`);
      }
      
      // Log the caption edit
      try {
        await xdelo_logProcessingEvent(
          "message_caption_edited",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            previous_caption: existingMessage.caption,
            new_caption: message.caption
          }
        );
      } catch (logError) {
        loggerAdapter.error(`Failed to log caption edit operation`, logError);
      }
    } else {
      // No significant changes detected
      loggerAdapter.info(`No significant changes detected in edit for message ${message.message_id}`);
      
      // Update data for edit metadata
      const updateData = {
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_count: (existingMessage.edit_count || 0) + 1,
        edit_history: editHistory,
        last_edited_at: new Date().toISOString(),
        correlation_id: correlationId
      };
      
      // Update using shared function
      const result = await xdelo_updateMessage(
        message.chat.id,
        message.message_id,
        updateData,
        loggerAdapter
      );
        
      if (!result.success) {
        loggerAdapter.warn(`Failed to update edit metadata: ${result.error_message}`);
      }
      
      // Log the edit operation anyway
      try {
        await xdelo_logProcessingEvent(
          "message_edit_received",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            no_changes: true
          }
        );
      } catch (logError) {
        loggerAdapter.error('Error logging edit operation:', logError);
      }
    }

    return createSuccessResponse({ success: true });
  }
  
  // If existing message not found, handle as new message
  loggerAdapter.info(`Original message not found, creating new message for edit ${message.message_id}`);
  return await xdelo_handleNewMediaMessage(message, context);
}

/**
 * Helper function to handle new media messages
 */
async function xdelo_handleNewMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  const { correlationId, logger } = context;
  const loggerAdapter = createLoggerAdapter(logger);
  
  // First check if this is a duplicate message we've already processed
  try {
    const isDuplicate = await xdelo_checkDuplicateFile(
      message.message_id,
      message.chat.id
    );
    
    if (isDuplicate) {
      loggerAdapter.info(`Duplicate message detected: ${message.message_id} in chat ${message.chat.id}`);
      
      // Log the duplicate detection
      await xdelo_logProcessingEvent(
        "duplicate_message_detected",
        crypto.randomUUID().toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_group_id: message.media_group_id
        }
      );
      
      return createSuccessResponse({ success: true, duplicate: true, correlationId });
    }
    
    // Process the media message
    const { data: messageUrl, error: urlError } = await supabaseClient.rpc(
      'xdelo_construct_telegram_message_url',
      {
        chat_type: message.chat.type || 'unknown',
        chat_id: message.chat.id,
        id: message.message_id
      }
    );
    
    if (urlError) {
      loggerAdapter.warn('Error generating message URL', urlError);
    }
    
    loggerAdapter.info(`Processing new media message: ${message.message_id}`, {
      chat_id: message.chat.id,
      message_url: messageUrl
    });
    
    // Safely determine the current file details
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      (message.video || message.document || null);
    
    if (!telegramFile) {
      throw new Error('No media file found in message');
    }
    
    // Process media
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN || ''
    );
    
    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }
    
    // Prepare forward info if message is forwarded
    const forwardInfo: ForwardInfo | undefined = message.forward_origin ? {
      is_forwarded: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_chat_type: message.forward_origin.chat?.type,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
      original_chat_id: message.forward_origin.chat?.id,
      original_chat_title: message.forward_origin.chat?.title,
      original_message_id: message.forward_origin.message_id
    } : undefined;
    
    // Helper to safely get width/height
    const getMediaDimensions = (file: any) => {
      const dimensions = {
        width: undefined as number | undefined,
        height: undefined as number | undefined
      };
      
      if (file && typeof file === 'object') {
        if ('width' in file && typeof file.width === 'number') {
          dimensions.width = file.width;
        }
        if ('height' in file && typeof file.height === 'number') {
          dimensions.height = file.height;
        }
      }
      
      return dimensions;
    };
    
    const { width, height } = getMediaDimensions(telegramFile);
    
    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: mediaResult.fileInfo.mime_type,
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      width,
      height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size || mediaResult.fileInfo.file_size,
      correlation_id: correlationId,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
      is_forward: context.isForwarded,
      edit_history: context.isEdit ? [{
        timestamp: new Date().toISOString(),
        is_initial_edit: true,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      }] : [],
      storage_exists: true,
      storage_path_standardized: true,
      message_url: messageUrl
    };
    
    // Create the message
    const result = await xdelo_createMessage(messageInput, loggerAdapter);
    
    if (!result.success) {
      loggerAdapter.error(`Failed to create message: ${result.error_message}`, {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      
      // Also try to log to the database
      await xdelo_logProcessingEvent(
        "message_creation_failed",
        crypto.randomUUID().toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: result.error_message
        }
      );
      
      throw new Error(result.error_message || 'Failed to create message record');
    }
    
    // Log the success
    loggerAdapter.info(`Successfully created new media message: ${result.id}`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      storage_path: mediaResult.fileInfo.storage_path
    });
    
    return createSuccessResponse({ success: true, id: result.id, correlationId });
  } catch (createError) {
    loggerAdapter.error(`Error creating new media message`, createError);
    
    // Log detailed error to database
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        crypto.randomUUID().toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: createError instanceof Error ? createError.message : String(createError),
          stack: createError instanceof Error ? createError.stack : undefined,
          media_group_id: message.media_group_id
        },
        createError instanceof Error ? createError.message : String(createError)
      );
    } catch (logError) {
      loggerAdapter.error(`Error logging failure:`, logError);
    }
    
    // Re-throw to be caught by the main handler
    throw createError;
  }
}

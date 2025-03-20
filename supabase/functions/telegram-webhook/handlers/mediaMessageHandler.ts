import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_generateStoragePath,
  xdelo_detectMimeType,
  xdelo_isViewableMimeType
} from '../../_shared/mediaUtils/index.ts';
import {
  xdelo_findExistingFile,
  xdelo_processMessageMedia
} from '../../_shared/mediaStorage.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { createMessage, checkDuplicateFile } from '../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../_shared/messageUtils.ts';

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

/**
 * Main handler for media messages from Telegram
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;
    
    // Log the start of processing
    logger?.info(`Processing ${isEdit ? 'edited' : 'new'} media message`, {
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
    context.logger?.error(`Error processing media message: ${errorMessage}`, {
      error: error instanceof Error ? error : { message: errorMessage },
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    // Also log to database for tracking
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: errorMessage
        },
        errorMessage
      );
    } catch (logError) {
      context.logger?.error(`Failed to log error to database: ${
        logError instanceof Error ? logError.message : String(logError)}`);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
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

  // First, look up the existing message
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (lookupError) {
    logger?.error(`Failed to lookup existing message for edit: ${lookupError.message}`);
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
        logger?.info(`Media has changed in edit for message ${message.message_id}`);
        
        // Determine the current file details
        const telegramFile = message.photo ? 
          message.photo[message.photo.length - 1] : 
          message.video || message.document;
          
        // Validate that we have a valid file to process
        if (!telegramFile) {
          throw new Error(`No valid media content found in edited message ${message.message_id}`);
        }

        // Validate file_id integrity
        if (!telegramFile.file_id || telegramFile.file_id.length < 10) {
          logger?.error(`Invalid file_id format in edited message ${message.message_id}`, {
            file_id_length: telegramFile.file_id?.length || 0,
            media_type: message.photo ? 'photo' : message.video ? 'video' : 'document'
          });
          throw new Error(`Invalid file_id format in edited message ${message.message_id}`);
        }

        // Log complete file information for debugging
        logger?.info(`Processing edited media file with complete details`, {
          file_id_length: telegramFile.file_id.length,
          file_unique_id: telegramFile.file_unique_id,
          media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
          mime_type: message.document?.mime_type || message.video?.mime_type || 'unknown'
        });
          
        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);
        
        // Process the new media file with safe handling
        try {
          const mediaProcessResult = await xdelo_processMessageMedia(
            message,
            telegramFile.file_id,
            telegramFile.file_unique_id,
            TELEGRAM_BOT_TOKEN || '',
            existingMessage.id // Use existing message ID
          );
          
          if (!mediaProcessResult.success) {
            logger?.error(`Failed to process edited media: ${mediaProcessResult.error}`, {
              file_id_length: telegramFile.file_id.length,
              error: mediaProcessResult.error
            });
            
            // Update message with error information but keep existing data
            const { error: updateError } = await supabaseClient
              .from('messages')
              .update({
                edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
                edit_count: (existingMessage.edit_count || 0) + 1,
                edit_history: editHistory,
                processing_state: 'edit_download_failed',
                needs_redownload: true,
                download_error: mediaProcessResult.error,
                last_edited_at: new Date().toISOString()
              })
              .eq('id', existingMessage.id);
              
            // Log the error
            await xdelo_logProcessingEvent(
              "edit_media_download_failed",
              existingMessage.id,
              correlationId,
              {
                message_id: message.message_id,
                chat_id: message.chat.id,
                file_id: telegramFile.file_id,
                file_id_length: telegramFile.file_id.length,
                file_unique_id: telegramFile.file_unique_id,
                error: mediaProcessResult.error
              },
              mediaProcessResult.error
            );
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: mediaProcessResult.error,
                needs_redownload: true,
                correlationId 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          // If successful, update the message with new media info using safe property access
          const { data: updateResult, error: updateError } = await supabaseClient
            .from('messages')
            .update({
              caption: message.caption,
              file_id: telegramFile.file_id,
              file_unique_id: telegramFile.file_unique_id,
              mime_type: detectedMimeType,
              // Safe access to properties that might not exist on document type
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
              last_edited_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id);
            
          if (updateError) {
            throw new Error(`Failed to update message with new media: ${updateError.message}`);
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
                file_id_length: telegramFile.file_id.length,
                file_unique_id: telegramFile.file_unique_id,
                storage_path: mediaProcessResult.fileInfo.storage_path
              }
            );
          } catch (logError) {
            logger?.error(`Failed to log media edit operation: ${logError.message}`);
          }
        } catch (mediaError) {
          // Handle media processing errors specifically
          logger?.error(`Error processing edited media: ${
            mediaError instanceof Error ? mediaError.message : String(mediaError)}`, {
            message_id: message.message_id,
            file_id_length: telegramFile.file_id.length
          });
          
          throw mediaError;
        }
      } catch (mediaError) {
        logger?.error(`Error processing edited media: ${mediaError.message}`);
        throw mediaError;
      }
    } 
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      logger?.info(`Caption has changed in edit for message ${message.message_id}`);
      
      // Update just the caption
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        throw new Error(`Failed to update message caption: ${updateError.message}`);
      }
      
      // Process the new caption
      if (message.caption) {
        // Process caption changes - this could trigger analysis, etc.
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
        logger?.error(`Failed to log caption edit operation: ${logError.message}`);
      }
    } else {
      // No significant changes detected
      logger?.info(`No significant changes detected in edit for message ${message.message_id}`);
      
      // Still update the edit metadata
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        logger?.warn(`Failed to update edit metadata: ${updateError.message}`);
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
        console.error('Error logging edit operation:', logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If existing message not found, handle as new message
  logger?.info(`Original message not found, creating new message for edit ${message.message_id}`);
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
  
  // First check if this is a duplicate message we've already processed
  try {
    const isDuplicate = await checkDuplicateFile(
      supabaseClient,
      message.message_id,
      message.chat.id
    );
    
    if (isDuplicate) {
      logger?.info(`Duplicate message detected: ${message.message_id} in chat ${message.chat.id}`);
      
      // Log the duplicate detection
      await xdelo_logProcessingEvent(
        "duplicate_message_detected",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_group_id: message.media_group_id
        }
      );
      
      return new Response(
        JSON.stringify({ success: true, duplicate: true, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the media message
    const messageUrl = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    logger?.info(`Processing new media message: ${message.message_id}`, {
      chat_id: message.chat.id,
      message_url: messageUrl
    });
    
    // Safely extract the Telegram file with proper validation
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    // Validate that we have a valid file to process
    if (!telegramFile) {
      throw new Error(`No valid media content found in message ${message.message_id}`);
    }

    // Validate file_id integrity
    if (!telegramFile.file_id || telegramFile.file_id.length < 10) {
      logger?.error(`Invalid file_id format in message ${message.message_id}`, {
        file_id_length: telegramFile.file_id?.length || 0,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document'
      });
      throw new Error(`Invalid file_id format in message ${message.message_id}`);
    }

    // Validate file_unique_id
    if (!telegramFile.file_unique_id) {
      throw new Error(`Missing file_unique_id in message ${message.message_id}`);
    }

    // Log complete file information for debugging
    logger?.info(`Processing media file with complete details`, {
      file_id_length: telegramFile.file_id.length,
      file_unique_id: telegramFile.file_unique_id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      mime_type: message.document?.mime_type || message.video?.mime_type || 'unknown'
    });
    
    // Try to process media with robust error handling
    try {
      const mediaResult = await xdelo_processMessageMedia(
        message,
        telegramFile.file_id,
        telegramFile.file_unique_id,
        TELEGRAM_BOT_TOKEN || ''
      );
      
      if (!mediaResult.success) {
        logger?.error(`Failed to process media: ${mediaResult.error}`, {
          file_id_length: telegramFile.file_id.length,
          error: mediaResult.error
        });
        
        // Create a fallback record with download failure information
        const fallbackMessageInput: MessageInput = {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          caption: message.caption,
          media_group_id: message.media_group_id,
          file_id: telegramFile.file_id,
          file_unique_id: telegramFile.file_unique_id,
          mime_type: xdelo_detectMimeType(message),
          mime_type_original: message.document?.mime_type || message.video?.mime_type,
          // Use a placeholder storage path
          storage_path: `failed-download-${telegramFile.file_unique_id}`,
          // Safe access to properties that might not exist on document type
          width: 'width' in telegramFile ? telegramFile.width : undefined,
          height: 'height' in telegramFile ? telegramFile.height : undefined,
          duration: message.video?.duration,
          file_size: telegramFile.file_size,
          correlation_id: correlationId,
          processing_state: 'download_failed',
          telegram_data: message,
          storage_exists: false,
          needs_redownload: true,
          message_url: messageUrl
        };
        
        // Create the message record despite download failure
        const fallbackResult = await createMessage(
          supabaseClient, 
          fallbackMessageInput, 
          {
            error: (msg: string, data: any) => logger?.error(msg, data) || console.error(msg, data),
            info: (msg: string, data?: any) => logger?.info(msg, data) || console.log(msg, data),
            warn: (msg: string, data?: any) => logger?.warn(msg, data) || console.warn(msg, data)
          }
        );
        
        await xdelo_logProcessingEvent(
          "media_download_failed",
          message.message_id.toString(),
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            file_id_length: telegramFile.file_id.length,
            file_unique_id: telegramFile.file_unique_id,
            error: mediaResult.error
          }
        );
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: mediaResult.error,
            needs_redownload: true,
            id: fallbackResult.id,
            correlationId 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Successfully processed media, continue with regular flow
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
      
      // Create message input with safe property access
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
        // Safe access to properties that might not exist on document type
        width: 'width' in telegramFile ? telegramFile.width : undefined,
        height: 'height' in telegramFile ? telegramFile.height : undefined,
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
      
      // Create the message with logger adapter
      const result = await createMessage(
        supabaseClient, 
        messageInput, 
        {
          error: (msg: string, data: any) => logger?.error(msg, data) || console.error(msg, data),
          info: (msg: string, data?: any) => logger?.info(msg, data) || console.log(msg, data),
          warn: (msg: string, data?: any) => logger?.warn(msg, data) || console.warn(msg, data)
        }
      );
      
      if (!result.success) {
        logger?.error(`Failed to create message: ${result.error_message}`, {
          message_id: message.message_id,
          chat_id: message.chat.id
        });
        
        // Also try to log to the database
        await xdelo_logProcessingEvent(
          "message_creation_failed",
          message.message_id.toString(),
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
      logger?.success(`Successfully created new media message: ${result.id}`, {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        storage_path: mediaResult.fileInfo.storage_path
      });
      
      return new Response(
        JSON.stringify({ success: true, id: result.id, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (mediaError) {
      // Handle media processing errors
      logger?.error(`Media processing error: ${
        mediaError instanceof Error ? mediaError.message : String(mediaError)}`, {
        message_id: message.message_id,
        error_type: typeof mediaError,
        file_id_length: telegramFile.file_id.length
      });
      
      throw mediaError;
    }
  } catch (createError) {
    logger?.error(`Error creating new media message: ${
      createError instanceof Error ? createError.message : String(createError)}`, {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      error_type: typeof createError,
      error_keys: typeof createError === 'object' ? Object.keys(createError) : 'N/A'
    });
    
    // Log detailed error to database
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
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
      console.error(`Error logging failure: ${
        logError instanceof Error ? logError.message : String(logError)}`);
    }
    
    // Re-throw to be caught by the main handler
    throw createError;
  }
}

/**
 * Import from shared/databaseOperations.ts
 */
async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata?: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId,
      metadata,
      error_message: errorMessage
    });
    
    if (error) {
      console.error(`Error logging event ${eventType}:`, error);
    }
  } catch (e) {
    console.error(`Exception logging event ${eventType}:`, e);
  }
}

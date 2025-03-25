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
  createMessage,
  updateMessage,
  checkDuplicateFile,
  xdelo_logProcessingEvent
} from '../../_shared/databaseOperations.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';

// Get Telegram bot token from environment - using environment variable
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
      chat_id: message.chat.id,
      has_caption: !!message.caption,
      media_group_id: message.media_group_id
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
    context.logger?.error(`Error processing media message: ${errorMessage}`, error);
    
    // Also log to database for tracking
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        },
        errorMessage
      );
    } catch (logError) {
      context.logger?.error(`Failed to log error to database`, logError);
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
        
        // If successful, update the message with new media info
        const { data: updateResult, error: updateError } = await supabaseClient
          .from('messages')
          .update({
            caption: message.caption,
            file_id: telegramFile.file_id,
            file_unique_id: telegramFile.file_unique_id,
            mime_type: detectedMimeType,
            width: telegramFile.width,
            height: telegramFile.height,
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
              file_unique_id: telegramFile.file_unique_id,
              storage_path: mediaProcessResult.fileInfo.storage_path
            }
          );
        } catch (logError) {
          logger?.error(`Failed to log media edit operation: ${logError.message}`);
        }
      } catch (mediaError) {
        logger?.error(`Error processing edited media: ${mediaError.message}`);
        throw mediaError;
      }
    } 
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      logger?.info(`Caption has changed in edit for message ${message.message_id}`);
      
      try {
        // Update just the caption and edit metadata
        const { data: updateResult, error: updateError } = await supabaseClient
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
      } catch (captionError) {
        logger?.error(`Error updating caption: ${captionError.message}`);
        throw captionError;
      }
    }
    // If nothing significant has changed, log the edit but don't update
    else {
      logger?.info(`No significant changes detected in edit for message ${message.message_id}`);
      
      try {
        await xdelo_logProcessingEvent(
          "message_edited_no_changes",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          }
        );
      } catch (logError) {
        logger?.error(`Failed to log no-change edit: ${logError.message}`);
      }
    }
    
    // Return a success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: message.message_id,
        chat_id: message.chat.id,
        message: "Media message edit processed successfully",
        correlationId
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } else {
    // If message doesn't exist, create it as a new message
    logger?.info(`Message not found for edit, processing as new message: ${message.message_id}`);
    return await xdelo_handleNewMediaMessage(message, context);
  }
}

/**
 * Helper function to handle new media messages
 */
async function xdelo_handleNewMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // First check if we've already processed this message ID
    const isDuplicate = await checkDuplicateFile(
      supabaseClient,
      message.message_id,
      message.chat.id
    );
    
    if (isDuplicate) {
      logger?.info(`Found duplicate media message, skipping: ${message.message_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Duplicate message detected, already processed",
          correlationId
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine the file to process
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : // Get largest photo
      message.video || message.document;
      
    if (!telegramFile || !telegramFile.file_id) {
      throw new Error("No valid media file found in message");
    }
    
    // Process media file
    logger?.info(`Processing media file: ${telegramFile.file_id.substring(0, 10)}...`);
    
    // Process the message with our helper
    const processResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );
    
    if (!processResult.success || !processResult.fileInfo) {
      throw new Error(`Media processing failed: ${processResult.error || "Unknown error"}`);
    }
    
    // Check if the file is already in the database by its unique file ID
    const existingFile = await checkDuplicateFile(
      supabaseClient,
      undefined,
      undefined,
      telegramFile.file_unique_id
    );
    
    if (existingFile) {
      logger?.info(`Found existing file with same unique ID: ${telegramFile.file_unique_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "File with same content already exists",
          correlationId
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract forward info if the message is forwarded
    let forwardInfo: ForwardInfo | undefined;
    if (message.forward_date || message.forward_from || message.forward_from_chat || message.forward_origin) {
      forwardInfo = {
        date: message.forward_date,
        from: message.forward_from,
        from_chat: message.forward_from_chat,
        origin: message.forward_origin
      };
    }
    
    // Create message URL if available
    let messageUrl = undefined;
    if (message.chat.username && message.message_id) {
      messageUrl = `https://t.me/${message.chat.username}/${message.message_id}`;
    }
    
    // Construct input data for database
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title || message.chat.username || message.chat.first_name,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: processResult.fileInfo.mime_type,
      file_size: telegramFile.file_size,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      storage_path: processResult.fileInfo.storage_path,
      public_url: processResult.fileInfo.public_url,
      correlation_id: correlationId,
      telegram_data: message,
      forward_info: forwardInfo,
      is_edited_channel_post: context.isChannelPost,
      message_url: messageUrl
    };
    
    // Save to database
    logger?.info(`Saving media message to database`, {
      message_id: message.message_id,
      chat_id: message.chat.id,
      file_id: telegramFile.file_id.substring(0, 10) + '...'
    });
    
    const createResult = await createMessage(
      supabaseClient,
      messageInput,
      logger
    );
    
    if (!createResult.success) {
      throw new Error(`Failed to save message to database: ${createResult.error_message}`);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message_id: message.message_id,
        chat_id: message.chat.id,
        db_id: createResult.id,
        message: "Media message processed successfully",
        correlationId
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Error handling done at the upper level
    throw error;
  }
}


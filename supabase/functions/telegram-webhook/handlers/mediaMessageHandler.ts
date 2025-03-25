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
} from '../../_shared/mediaStorage.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { createMessage, checkDuplicateFile, findExistingFileByUniqueId, updateWithExistingAnalysis } from '../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../_shared/messageUtils.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';

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
    const { correlationId, isEdit, previousMessage, logger, supabase } = context;
    
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
    
    try {
      context.logger?.error(`Error processing media message: ${errorMessage}`, {
        error: error instanceof Error ? error : { message: errorMessage },
        message_id: message.message_id,
        chat_id: message.chat?.id
      });
    } catch (loggerError) {
      console.error('Failed to log error via logger:', loggerError);
    }
    
    // Safely log to database - never throw from here
    try {
      // Use direct client if available
      if (context.supabase) {
        try {
          await context.supabase.from('unified_audit_logs').insert({
            event_type: "media_processing_error",
            entity_id: String(message.message_id),
            metadata: {
              message_id: message.message_id,
              chat_id: message.chat?.id,
              error: errorMessage,
              correlation_id: context.correlationId,
              logged_from: 'edge_function_direct',
              timestamp: new Date().toISOString()
            },
            error_message: errorMessage,
            correlation_id: context.correlationId,
            event_timestamp: new Date().toISOString()
          });
        } catch (dbError) {
          console.error('Failed to log using direct client:', dbError);
        }
      } else {
        try {
          await xdelo_logProcessingEvent(
            "media_processing_error",
            message.message_id,
            context.correlationId,
            {
              message_id: message.message_id,
              chat_id: message.chat?.id,
              error: errorMessage
            },
            errorMessage
          );
        } catch (logError) {
          console.error('Failed to log using log function:', logError);
        }
      }
    } catch (outerError) {
      console.error('Error in error handling:', outerError);
    }
    
    // Always return a response to Telegram, even if everything else fails
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
  const { correlationId, logger, supabase } = context;
  const dbClient = supabase || supabaseClient;

  // First, look up the existing message
  const { data: existingMessage, error: lookupError } = await dbClient
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
        const { data: updateResult, error: updateError } = await dbClient
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
      
      // Update just the caption
      const { error: updateError } = await dbClient
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
      const { error: updateError } = await dbClient
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
 * Handle a new (non-edited) media message
 */
async function xdelo_handleNewMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  const { correlationId, logger, supabase } = context;
  const dbClient = supabase || supabaseClient;
  
  // First, check if this message is a duplicate webhook
  const isDuplicate = await checkDuplicateFile(dbClient, message.message_id, message.chat.id);
  
  if (isDuplicate) {
    logger?.info(`Skipping duplicate message ${message.message_id} in chat ${message.chat.id}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Duplicate message skipped",
      correlationId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Process the media message
  const messageUrl = constructTelegramMessageUrl(message.chat.id, message.message_id);
  
  logger?.info(`Processing new media message: ${message.message_id}`, {
    chat_id: message.chat.id,
    message_url: messageUrl
  });
  
  // Prepare the message data - safely extract the file information
  // using null checks to avoid "possibly undefined" errors
  let telegramFile;
  if (message.photo && message.photo.length > 0) {
    telegramFile = message.photo[message.photo.length - 1];
  } else if (message.video) {
    telegramFile = message.video;
  } else if (message.document) {
    telegramFile = message.document;
  } else {
    throw new Error("No media found in message");
  }
  
  // Process media
  const mediaResult = await xdelo_processMessageMedia(
    message,
    telegramFile.file_id,
    telegramFile.file_unique_id,
    TELEGRAM_BOT_TOKEN
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
  
  // Check if we have an existing file with the same file_unique_id
  // This will allow us to reuse analysis from previously processed identical files
  let hasExistingAnalysis = false;
  let existingAnalysis = null;
  let duplicateOfMessageId = null;
  
  try {
    const { exists, messageId, analyzedContent } = await findExistingFileByUniqueId(
      dbClient, 
      telegramFile.file_unique_id,
      logger
    );
    
    if (exists && analyzedContent) {
      hasExistingAnalysis = true;
      existingAnalysis = analyzedContent;
      duplicateOfMessageId = messageId;
      
      logger?.info(`Found existing analysis for file_unique_id: ${telegramFile.file_unique_id}`, {
        source_message_id: messageId
      });
    }
  } catch (error) {
    // Just log the error but continue processing
    logger?.warn(`Error checking for existing file: ${error.message}`, { error });
  }
  
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
    width: "width" in telegramFile ? telegramFile.width : undefined,
    height: "height" in telegramFile ? telegramFile.height : undefined,
    duration: message.video?.duration,
    file_size: telegramFile.file_size || mediaResult.fileInfo.file_size,
    correlation_id: correlationId,
    processing_state: hasExistingAnalysis ? 'completed' : (message.caption ? 'pending' : 'initialized'),
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
    message_url: messageUrl,
    // Add fields for duplicate content handling
    is_duplicate_content: hasExistingAnalysis,
    analyzed_content: existingAnalysis,
    duplicate_of_message_id: duplicateOfMessageId
  };
  
  // Create the message
  const result = await createMessage(dbClient, messageInput, logger);
  
  if (!result.success) {
    logger?.error(`Failed to create message: ${result.error_message}`, {
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    
    // Also try to log to the database
    try {
      await xdelo_logProcessingEvent(
        "message_creation_failed",
        String(message.message_id),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: result.error_message
        }
      );
    } catch (logError) {
      logger?.error(`Failed to log message creation failure: ${logError.message}`);
    }
    
    throw new Error(result.error_message || 'Failed to create message record');
  }
  
  // Log the success
  let responseMessage = "Successfully created new media message";
  if (hasExistingAnalysis) {
    responseMessage = "Created new message with existing analysis from duplicate file";
  }
  
  logger?.success(`${responseMessage}: ${result.id}`, {
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
    storage_path: mediaResult.fileInfo.storage_path,
    is_duplicate_content: hasExistingAnalysis
  });
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      id: result.id, 
      is_duplicate_content: hasExistingAnalysis,
      correlationId 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

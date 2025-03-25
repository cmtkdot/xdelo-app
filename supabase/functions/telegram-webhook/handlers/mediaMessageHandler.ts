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

/**
 * Helper function to extract forward info from message
 */
function extractForwardInfo(message: TelegramMessage): ForwardInfo | undefined {
  if (!message.forward_origin) return undefined;
  
  return {
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
  };
}

/**
 * Trigger caption processing via the database function
 * 
 * This calls the xdelo_process_caption_workflow PostgreSQL function to
 * process the caption and update the analyzed_content
 */
async function triggerCaptionProcessing(
  messageId: string, 
  correlationId: string, 
  force = false,
  client = supabaseClient,
  logger?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    logger?.info(`Triggering caption processing for message ${messageId}`, {
      correlation_id: correlationId,
      force
    });
    
    // Call the database function to process the caption
    const { data, error } = await client.rpc('xdelo_process_caption_workflow', {
      p_message_id: messageId,
      p_correlation_id: correlationId,
      p_force: force
    });
    
    if (error) {
      logger?.error(`Error triggering caption processing: ${error.message}`, {
        messageId,
        correlationId,
        error
      });
      return { success: false, error: error.message };
    }
    
    logger?.info(`Caption processing triggered successfully for message ${messageId}`, {
      result: data
    });
    
    return { success: true };
  } catch (error: any) {
    logger?.error(`Exception in triggerCaptionProcessing: ${error.message}`, {
      messageId,
      correlationId,
      error
    });
    return { success: false, error: error.message };
  }
}

// Get Telegram bot token from environment
// @ts-ignore - Deno global is available in Deno environment
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
        } catch (logError: any) {
          console.error('Failed to log using log function:', logError.message);
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
              file_unique_id: telegramFile.file_unique_id,
              storage_path: mediaProcessResult.fileInfo.storage_path
            }
          );
        } catch (logError: any) {
          logger?.error(`Failed to log media edit operation: ${logError.message}`);
        }
        
        // If message has a caption, trigger caption processing
        if (message.caption) {
          try {
            const processingResult = await triggerCaptionProcessing(
              existingMessage.id,
              correlationId,
              true, // Force reprocessing since this is an edit
              dbClient,
              logger
            );
            
            if (!processingResult.success) {
              logger?.warn(`Caption processing trigger failed: ${processingResult.error}`);
            }
          } catch (captionError: any) {
            logger?.error(`Error triggering caption processing: ${captionError.message}`);
            // Don't fail the whole operation if caption processing fails
          }
        }
      } catch (mediaError: any) {
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
        try {
          const processingResult = await triggerCaptionProcessing(
            existingMessage.id,
            correlationId,
            true, // Force reprocessing since this is an edit
            dbClient,
            logger
          );
          
          if (!processingResult.success) {
            logger?.warn(`Caption processing trigger failed: ${processingResult.error}`);
          }
        } catch (captionError: any) {
          logger?.error(`Error triggering caption processing: ${captionError.message}`);
          // Don't fail the whole operation if caption processing fails
        }
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
      } catch (logError: any) {
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
    logger?.info(`Detected duplicate message ${message.message_id} in chat ${message.chat.id}`);
    
    // Instead of immediately returning, try to fetch the existing message
    // This mirrors the edited message flow where we look up and potentially update
    const { data: existingMessage, error: lookupError } = await dbClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();
    
    if (lookupError) {
      logger?.warn(`Failed to lookup existing message for duplicate: ${lookupError.message}`);
      // If we can't fetch the message, just acknowledge the webhook anyway
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Duplicate acknowledged but not updated",
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // If we found the message, log the duplicate but don't try to update
    // Just log the event for tracking
    try {
      await xdelo_logProcessingEvent(
        "duplicate_message_received",
        existingMessage.id,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          duplicate_detected: true
        }
      );
    } catch (logError) {
      console.error('Error logging duplicate operation:', logError);
    }
    
    // Return success as we've acknowledged and logged the duplicate
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Duplicate message tracked",
      correlationId,
      message_id: existingMessage.id
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
  } catch (error: any) {
    // Just log the error but continue processing
    logger?.warn(`Error checking for existing file: ${error.message}`, { error });
  }
  
  // Initialize message state based on caption and media group
  let initialState = 'completed'; // Default for messages without caption
  
  // If the message has a caption, set to pending for immediate caption processing
  if (message.caption) {
    initialState = 'pending'; // Set to pending for caption processing
    logger?.info('Message has caption, setting initial state to pending for caption processing', {
      caption_length: message.caption.length
    });
  }
  
  // Create the message record in the database
  const result = await createMessage(supabase, {
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    chat_type: message.chat.type,
    chat_title: message.chat.title,
    media_group_id: message.media_group_id,
    file_id: telegramFile.file_id,
    file_unique_id: telegramFile.file_unique_id,
    mime_type: mediaResult.fileInfo.mime_type,
    mime_type_original: message.document?.mime_type || message.video?.mime_type,
    width: 'width' in telegramFile ? telegramFile.width : undefined,
    height: 'height' in telegramFile ? telegramFile.height : undefined,
    duration: message.video?.duration,
    file_size: telegramFile.file_size,
    caption: message.caption,
    storage_path: mediaResult.fileInfo.storage_path,
    public_url: mediaResult.fileInfo.public_url,
    telegram_data: message,
    message_url: constructTelegramMessageUrl(message.chat.id, message.message_id),
    is_forward: context.isForwarded,
    forward_info: context.isForwarded ? extractForwardInfo(message) : undefined,
    correlation_id: context.correlationId,
    processing_state: initialState, // Use the determined initial state
    storage_exists: true,
    storage_path_standardized: mediaResult.fileInfo.storage_path_standardized,
    is_duplicate_content: hasExistingAnalysis
  });
  
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
    } catch (logError: any) {
      logger?.error(`Failed to log message creation failure: ${logError.message}`);
    }
    
    throw new Error(result.error_message || 'Failed to create message record');
  }
  
  // If the message has a caption, trigger caption processing
  if (message.caption && result.id) {
    try {
      const processingResult = await triggerCaptionProcessing(
        result.id,
        correlationId,
        false, // Don't force reprocessing for new messages
        dbClient,
        logger
      );
      
      if (!processingResult.success) {
        logger?.warn(`Caption processing trigger failed: ${processingResult.error}`);
      } else {
        logger?.info(`Successfully triggered caption processing for message ${result.id}`);
      }
    } catch (captionError: any) {
      logger?.error(`Error triggering caption processing: ${captionError.message}`);
      // Don't fail the whole operation if caption processing fails
    }
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

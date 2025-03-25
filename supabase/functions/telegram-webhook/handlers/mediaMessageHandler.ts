import { supabaseClient } from '../utils/supabase.ts';
import { corsHeaders } from '../utils/cors.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_validateAndFixStoragePath,
  xdelo_isViewableMimeType,
  xdelo_detectMimeType,
  xdelo_checkFileExistsInStorage
} from '../utils/media/mediaUtils.ts';
import {
  xdelo_findExistingFile,
  xdelo_processMessageMedia,
  xdelo_handleExpiredFileId
} from '../utils/media/mediaStorage.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { createMessage, checkDuplicateFile } from '../dbOperations.ts';
import { constructTelegramMessageUrl } from '../utils/messageUtils.ts';
import { xdelo_logProcessingEvent } from '../utils/databaseOperations.ts';
import { prepareEditHistoryEntry } from '../utils/messageUtils.ts';

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
    // Store previous state in edit_history using our utility function
    const editHistory = existingMessage.edit_history || [];
    
    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = message.photo || message.video || message.document;
    
    // Track caption changes
    if (captionChanged) {
      editHistory.push(prepareEditHistoryEntry(existingMessage, message, 'caption'));
    }
    
    // If media has been updated, handle the new media
    if (hasNewMedia) {
      editHistory.push(prepareEditHistoryEntry(existingMessage, message, 'media'));
      
      logger?.info(`Media has changed in edit for message ${message.message_id}`);
      
      try {
        logger?.info(`Media has changed in edit for message ${message.message_id}`);
        
        // Determine the current file details
        const telegramFile = message.photo ? 
          message.photo[message.photo.length - 1] : 
          message.video || message.document;
          
        if (!telegramFile) {
          throw new Error('Failed to extract file information from message');
        }
          
        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);
        
        // Process the new media file
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN || '',
          existingMessage.id, // Use existing message ID
          correlationId  // Pass correlation ID for logging
        );
        
        if (!mediaProcessResult.success) {
          // Handle expired file ID case
          if (mediaProcessResult.file_id_expired) {
            logger?.warn(`File ID expired for edit of message ${message.message_id}`);
            
            // Flag message for later redownload
            await xdelo_handleExpiredFileId(
              existingMessage.id,
              telegramFile.file_unique_id,
              correlationId
            );
            
            // Continue processing with the edit even if media download failed
            // This allows caption changes to still be processed
            
            // Update the message with new details except media
            const { error: updateError } = await supabaseClient
              .from('messages')
              .update({
                caption: message.caption,
                file_id: telegramFile.file_id, // Still update this for future retries
                file_unique_id: telegramFile.file_unique_id,
                mime_type: detectedMimeType,
                edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
                edit_count: (existingMessage.edit_count || 0) + 1,
                edit_history: editHistory,
                processing_state: message.caption ? 'pending' : existingMessage.processing_state,
                needs_redownload: true,
                redownload_reason: 'file_id_expired_during_edit',
                redownload_flagged_at: new Date().toISOString(),
                last_edited_at: new Date().toISOString()
              })
              .eq('id', existingMessage.id);
            
            if (updateError) {
              logger?.error(`Failed to update message with expired file details: ${updateError.message}`);
            }
            
            // Return success but indicate the file_id expired
            return new Response(
              JSON.stringify({ 
                success: true, 
                file_id_expired: true,
                message: 'Message updated but media could not be downloaded - file ID expired',
                correlationId 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          throw new Error(`Failed to process edited media: ${mediaProcessResult.error}`);
        }
        
        // Prepare update data with type checks
        const updateData: any = {
          caption: message.caption,
          file_id: telegramFile.file_id,
          file_unique_id: telegramFile.file_unique_id,
          mime_type: detectedMimeType,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          storage_path: mediaProcessResult.fileInfo.storage_path,
          public_url: mediaProcessResult.fileInfo.public_url,
          storage_exists: true,
          storage_path_standardized: true,
          last_edited_at: new Date().toISOString()
        };
        
        // Add optional fields only if they exist in telegramFile
        if ('width' in telegramFile) updateData.width = telegramFile.width;
        if ('height' in telegramFile) updateData.height = telegramFile.height;
        if (message.video?.duration) updateData.duration = message.video.duration;
        if (telegramFile.file_size) updateData.file_size = telegramFile.file_size;
        
        // Update the message with new media info
        const { data: updateResult, error: updateError } = await supabaseClient
          .from('messages')
          .update(updateData)
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
  
  // If existing message not found, check in other_messages
  const { data: existingTextMessage, error: textLookupError } = await supabaseClient
    .from('other_messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();
    
  if (!textLookupError && existingTextMessage) {
    // This was previously a text message that now has media added
    logger?.info(`Message was previously a text message, now has media. Converting.`, {
      message_id: message.message_id,
      existing_id: existingTextMessage.id
    });
    
    // Prepare edit history for the converted message
    const editHistory = existingTextMessage.edit_history || [];
    editHistory.push(prepareEditHistoryEntry(existingTextMessage, message, 'text_to_media'));
    
    // Process as new media message but preserve history
    context.previousTextMessage = existingTextMessage;
    context.conversionType = 'text_to_media';
    context.editHistory = editHistory;
    
    // Update the original text message to mark it as converted
    await supabaseClient
      .from('other_messages')
      .update({
        converted_to_media: true,
        edit_count: (existingTextMessage.edit_count || 0) + 1,
        edit_history: editHistory,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingTextMessage.id);
      
    // Process as new media with history context
    return await xdelo_handleNewMediaMessage(message, context);
  }
  
  // If existing message not found in either table, handle as new message
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
    
    // Prepare the message data
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    // Process media
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN || '',
      undefined, // No message ID yet since this is a new message
      correlationId
    );
    
    // Handle expired file ID case
    if (!mediaResult.success && mediaResult.file_id_expired) {
      logger?.warn(`File ID expired or invalid for new message ${message.message_id}`);
      
      // Still proceed with creating a record, but mark it for redownload
      const storagePathEstimate = `${telegramFile.file_unique_id}.${xdelo_detectMimeType(message).split('/')[1]}`;
      
      // Create an incomplete record to be updated later
      return await createIncompleteMediaRecord(
        message,
        telegramFile,
        storagePathEstimate,
        context,
        true // needs redownload
      );
    }
    
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
    
    // When creating a new media message, check if this is a conversion from text
    // and preserve the edit history
    const finalEditHistory = context.editHistory || 
      (context.isEdit ? [{
        timestamp: new Date().toISOString(),
        is_initial_edit: true,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      }] : []);
    
    // If this is a conversion from text, add a reference to the original text message
    const additionalFields = context.conversionType === 'text_to_media' && context.previousTextMessage ? {
      converted_from_text: true,
      original_text_id: context.previousTextMessage.id,
    } : {};
    
    // Create message input with preserved history
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
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size || mediaResult.fileInfo.file_size,
      correlation_id: correlationId,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
      is_forward: context.isForwarded,
      edit_history: finalEditHistory,
      storage_exists: true,
      storage_path_standardized: true,
      message_url: messageUrl,
      
      // Add any additional conversion fields
      ...additionalFields,
    };
    
    // Create the message
    const result = await createMessage(supabaseClient, messageInput, logger);
    
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
 * Create an incomplete media record when file_id has expired
 * but we want to create a record anyway for later processing
 */
async function createIncompleteMediaRecord(
  message: TelegramMessage,
  telegramFile: any,
  estimatedStoragePath: string,
  context: MessageContext,
  needsRedownload: boolean
): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Generate best-effort public URL based on estimated storage path
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const estimatedPublicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${estimatedStoragePath}`;
    
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
    
    // Create incomplete message record
    const messageInput: MessageInput = {
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
      storage_path: estimatedStoragePath,
      public_url: estimatedPublicUrl,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size,
      correlation_id: correlationId,
      processing_state: 'error', // Mark as error since media couldn't be processed
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      is_forward: context.isForwarded,
      storage_exists: false, // Media not in storage yet
      storage_path_standardized: true, // Path format is correct
      needs_redownload: needsRedownload,
      redownload_reason: 'file_id_expired',
      redownload_flagged_at: new Date().toISOString(),
      message_url: constructTelegramMessageUrl(message.chat.id, message.message_id),
      error_message: 'File ID expired or temporarily unavailable'
    };
    
    // Create the message
    const result = await createMessage(supabaseClient, messageInput, logger);
    
    if (!result.success) {
      throw new Error(result.error_message || 'Failed to create incomplete message record');
    }
    
    // Log the action
    await xdelo_logProcessingEvent(
      "incomplete_message_created",
      result.id,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        file_id: telegramFile.file_id,
        file_unique_id: telegramFile.file_unique_id,
        reason: 'file_id_expired'
      }
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        id: result.id, 
        file_id_expired: true,
        needs_redownload: true,
        message: 'Created incomplete record - media download will be retried later',
        correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger?.error(`Failed to create incomplete media record: ${error.message}`);
    
    // Re-throw for handling by the main handler
    throw error;
  }
}


import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { 
  xdelo_detectMimeType,
  xdelo_processMessageMedia
} from '../../utils/media/mediaUtils.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../../types.ts';
import { createMessage, checkDuplicateFile } from '../../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../utils/messageUtils.ts';
import { xdelo_logProcessingEvent, xdelo_processCaptionFromWebhook } from '../../../_shared/databaseOperations.ts';
import { createIncompleteMediaRecord } from './incompleteMediaHandler.ts';

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
 * Helper function to handle new media messages
 */
export async function handleNewMediaMessage(
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
    
    // Process caption immediately using unified processor if caption exists
    if (message.caption) {
      try {
        logger?.info("Processing initial caption for new media message", {
          message_id: result.id,
          caption_length: message.caption.length
        });
        
        // Use the unified processor
        await xdelo_processCaptionFromWebhook(
          result.id,
          correlationId,
          false // No need to force for initial processing
        );
      } catch (captionError) {
        logger?.warn("Error processing initial caption, will be retried later", {
          message_id: result.id,
          error: captionError.message
        });
        // Don't fail the whole process for caption processing errors
      }
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

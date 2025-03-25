import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { 
  xdelo_detectMimeType
} from '../../utils/media/mediaUtils.ts';
import { 
  xdelo_processMessageMedia
} from '../../utils/media/mediaStorage.ts';
import { 
  TelegramMessage, 
  MessageContext,
  MessageInput
} from '../../types.ts';
import { updateMessage } from '../../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../utils/messageUtils.ts';
import { 
  xdelo_logProcessingEvent, 
  xdelo_processCaptionFromWebhook 
} from '../../../_shared/databaseOperations.ts';

/**
 * Handler function to process edited media messages
 */
export async function handleEditedMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  previousMessage: any // Assuming previousMessage type is 'any' for now
): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Log the start of processing
    logger?.info(`Processing edited media message: ${message.message_id}`, {
      message_id: message.message_id,
      chat_id: message.chat.id
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
      Deno.env.get('TELEGRAM_BOT_TOKEN') || '',
      previousMessage.id, // Pass the previous message ID for updates
      correlationId
    );
    
    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }
    
    // Construct the message URL
    const messageUrl = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    // Prepare message input for updating the record
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
      telegram_data: message,
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      is_forward: context.isForwarded,
      storage_exists: true,
      storage_path_standardized: true,
      message_url: messageUrl
    };
    
    // Update the message
    const result = await updateMessage(supabaseClient, previousMessage.id, messageInput, logger);
    
    if (!result.success) {
      logger?.error(`Failed to update message: ${result.error_message}`, {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      
      // Also try to log to the database
      await xdelo_logProcessingEvent(
        "message_update_failed",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: result.error_message
        }
      );
      
      throw new Error(result.error_message || 'Failed to update message record');
    }
    
    // Process caption immediately using unified processor if caption exists
    if (message.caption) {
      try {
        logger?.info("Processing edited caption for media message", {
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
        logger?.warn("Error processing edited caption, will be retried later", {
          message_id: result.id,
          error: captionError.message
        });
        // Don't fail the whole process for caption processing errors
      }
    }
    
    logger?.success(`Successfully updated media message: ${result.id}`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      storage_path: mediaResult.fileInfo.storage_path
    });
    
    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (updateError) {
    logger?.error(`Error updating media message: ${
      updateError instanceof Error ? updateError.message : String(updateError)}`, {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      error_type: typeof updateError,
      error_keys: typeof updateError === 'object' ? Object.keys(updateError) : 'N/A'
    });
    
    // Log detailed error to database
    try {
      await xdelo_logProcessingEvent(
        "media_update_error",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: updateError instanceof Error ? updateError.message : String(updateError),
          stack: updateError instanceof Error ? updateError.stack : undefined,
          media_group_id: message.media_group_id
        },
        updateError instanceof Error ? updateError.message : String(updateError)
      );
    } catch (logError) {
      console.error(`Error logging failure: ${
        logError instanceof Error ? logError.message : String(logError)}`);
    }
    
    return new Response(
      JSON.stringify({ 
        error: updateError instanceof Error ? updateError.message : String(updateError),
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

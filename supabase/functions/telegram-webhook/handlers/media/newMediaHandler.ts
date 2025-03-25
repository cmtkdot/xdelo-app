import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { TelegramMessage, MessageContext, MessageInput } from '../../types.ts';
import { createMessage } from '../../database/messageOperations.ts';
import { xdelo_processCaptionFromWebhook } from '../../utils/databaseOperations.ts';

// Import other required utilities
import { xdelo_detectMimeType, xdelo_uploadMediaToStorage } from '../../utils/media/mediaUtils.ts';
import { constructTelegramMessageUrl } from '../../utils/messageUtils.ts';
import { createIncompleteMediaRecord } from './incompleteMediaHandler.ts';

/**
 * Handle new media messages (photos, videos, documents)
 */
export async function handleNewMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Extract relevant information from the Telegram message
    const telegramFile = message.photo ? message.photo[message.photo.length - 1] : message.document || message.video;
    
    if (!telegramFile) {
      throw new Error("No file information found in Telegram message");
    }
    
    // Detect MIME type
    const detectedMimeType = xdelo_detectMimeType(message);
    
    // Construct a storage path based on file_unique_id and detected extension
    const fileExtension = detectedMimeType ? detectedMimeType.split('/')[1] : 'unknown';
    const estimatedStoragePath = `${telegramFile.file_unique_id}.${fileExtension}`;
    
    // Check if file_id is present; if not, create an incomplete record
    if (!telegramFile.file_id) {
      logger?.warn("File ID missing from Telegram message", {
        message_id: message.message_id,
        chat_id: message.chat.id,
        file_unique_id: telegramFile.file_unique_id
      });
      
      // Create an incomplete record and return
      return await createIncompleteMediaRecord(message, telegramFile, estimatedStoragePath, context, true);
    }
    
    // Upload the media to Supabase storage
    const uploadResult = await xdelo_uploadMediaToStorage(message, context);
    
    if (!uploadResult.success) {
      // If upload fails due to file_id expiration, create an incomplete record
      if (uploadResult.error?.includes('File ID expired')) {
        logger?.warn("File ID expired during media upload", {
          message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: telegramFile.file_unique_id
        });
        
        // Create an incomplete record and return
        return await createIncompleteMediaRecord(message, telegramFile, estimatedStoragePath, context, true);
      }
      
      // Re-throw other upload errors for handling by the main handler
      throw new Error(uploadResult.error || 'Media upload failed');
    }
    
    // Prepare message input for database insertion
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: detectedMimeType,
      file_size: telegramFile.file_size,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      storage_path: uploadResult.storagePath,
      public_url: uploadResult.publicUrl,
      correlation_id: correlationId,
      is_edited_channel_post: context.isChannelPost,
      telegram_data: message,
      message_url: constructTelegramMessageUrl(message.chat.id, message.message_id)
    };
    
    // Create the message in the database
    const result = await createMessage(supabaseClient, messageInput, logger);
    
    if (!result.success) {
      throw new Error(result.error_message || 'Failed to create message record');
    }
    
    // If the message has a caption, start processing it
    if (message.caption) {
      try {
        // Trigger caption processing workflow
        const captionResult = await xdelo_processCaptionFromWebhook(result.id, correlationId);
        
        if (!captionResult.success) {
          logger?.warn(`Caption processing failed for message ${result.id}: ${captionResult.error}`);
        } else {
          logger?.info(`Caption processing triggered for message ${result.id}`);
        }
      } catch (captionError) {
        logger?.error(`Error triggering caption processing: ${captionError.message}`, {
          message_id: message.message_id,
          chat_id: message.chat.id
        });
      }
    }
    
    // Respond with success
    return new Response(
      JSON.stringify({ 
        success: true, 
        id: result.id, 
        message: 'Media message processed successfully',
        correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Log the error
    logger?.error(`Error processing new media message: ${error.message}`, {
      error: error instanceof Error ? error : { message: error.message },
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    // Return an error response
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

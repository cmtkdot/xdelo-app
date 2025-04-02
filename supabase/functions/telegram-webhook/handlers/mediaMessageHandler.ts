import {
    constructTelegramMessageUrl,
    extractTelegramMetadata,
    isMessageForwarded,
    logProcessingEvent
} from '../../_shared/consolidatedMessageUtils.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { createMediaMessage, syncMediaGroupContent } from '../dbOperations.ts';
import { MessageContext, TelegramMessage } from '../types.ts';

export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger } = context;
    
    // Determine if message is forwarded
    const isForwarded = isMessageForwarded(message);
    
    // Log the start of processing using object notation for better readability
    if (logger) {
      logger.info(`Processing media message ${message.message_id} in chat ${message.chat.id}`, {
        has_photo: !!message.photo,
        has_video: !!message.video,
        has_document: !!message.document,
        media_group_id: message.media_group_id,
        message_type: isChannelPost ? 'channel_post' : 'message',
        is_forwarded: isForwarded,
      });
    }
    
    // Generate message URL using consolidated function
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    // Process based on media type
    let file_id, file_unique_id, width, height, duration, mime_type, file_size;
    
    // Handle photos (use the largest size)
    if (message.photo) {
      const largestPhoto = message.photo[message.photo.length - 1];
      file_id = largestPhoto.file_id;
      file_unique_id = largestPhoto.file_unique_id;
      width = largestPhoto.width;
      height = largestPhoto.height;
    } 
    // Handle videos
    else if (message.video) {
      file_id = message.video.file_id;
      file_unique_id = message.video.file_unique_id;
      width = message.video.width;
      height = message.video.height;
      duration = message.video.duration;
      mime_type = message.video.mime_type;
      file_size = message.video.file_size;
    } 
    // Handle documents (could be any file type)
    else if (message.document) {
      file_id = message.document.file_id;
      file_unique_id = message.document.file_unique_id;
      mime_type = message.document.mime_type;
      file_size = message.document.file_size;
    }
    
    // Extract essential telegram metadata
    const telegramMetadata = extractTelegramMetadata(message);
    
    // Create message record
    const { id: messageId, success, error, is_duplicate } = await createMediaMessage({
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption || '',
      file_id,
      file_unique_id,
      media_group_id: message.media_group_id,
      mime_type,
      file_size,
      width,
      height,
      duration,
      telegram_data: message,
      telegram_metadata: telegramMetadata,
      processing_state: 'initialized',
      is_forward: isForwarded,
      correlation_id: correlationId,
      message_url: message_url
    });
      
    if (!success || !messageId) {
      if (logger) {
        logger.error(`Failed to store media message in database`, { error });
      }
      throw new Error(error || 'Failed to create message record');
    }
    
    // Handle duplicate media differently
    if (is_duplicate) {
      if (logger) {
        logger.info(`Processed duplicate media message ${message.message_id}`, {
          message_id: message.message_id,
          db_id: messageId,
          media_group_id: message.media_group_id,
          duplicate: true,
          message_url: message_url
        });
      }
      
      // Log duplicate detection
      await logProcessingEvent(
        "duplicate_media_detected",
        messageId,
        correlationId,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
          media_group_id: message.media_group_id,
          message_url: message_url
        }
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId, 
          correlationId,
          message_url: message_url,
          is_duplicate: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log successful processing using consolidated logging
    await logProcessingEvent(
      "media_message_created",
      messageId,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        media_group_id: message.media_group_id,
        is_forward: isForwarded,
        message_url: message_url
      }
    );
    
    if (logger) {
      logger.success(`Successfully processed media message ${message.message_id}`, {
        message_id: message.message_id,
        db_id: messageId,
        media_group_id: message.media_group_id,
        message_url: message_url
      });
    }
    
    // If part of a media group, check if we have other messages that have analyzed content
    if (message.media_group_id) {
      if (logger) {
        logger.info(`Media message ${message.message_id} belongs to group ${message.media_group_id}`);
      }
      
      // Try to sync content from existing messages in the group
      try {
        // Find a message with caption and sync from it
        const { success: syncSuccess, error: syncError, updatedCount } = await syncMediaGroupContent(
          messageId,
          message.media_group_id,
          correlationId
        );
        
        if (syncSuccess && updatedCount && updatedCount > 0) {
          if (logger) {
            logger.info(`Synced content to ${updatedCount} messages in media group ${message.media_group_id}`);
          }
        } else if (syncError) {
          if (logger) {
            logger.warn(`Media group sync warning: ${syncError}`);
          }
        }
      } catch (syncError) {
        if (logger) {
          logger.warn(`Failed to sync media group: ${syncError.message}`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId, 
        correlationId,
        message_url: message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (context.logger) {
      context.logger.error(`Error processing media message: ${error.message}`, { 
        error: error.stack,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
    }
    
    // Log the error using consolidated logging
    await logProcessingEvent(
      "media_message_processing_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document'
      },
      error.message
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing media message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

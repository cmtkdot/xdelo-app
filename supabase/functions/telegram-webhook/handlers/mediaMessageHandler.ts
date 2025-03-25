import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../../_shared/cors.ts";
import { processMessageCaptionDirect, scheduleMediaGroupSyncDirect } from "../utils/captionProcessing.ts";

/**
 * Handle incoming media messages (photos, videos, documents)
 */
export async function handleMediaMessage(message: any, context: any) {
  const { isChannelPost, isForwarded, correlationId, isEdit, logger, supabase } = context;
  const startTime = Date.now();
  
  try {
    // Extract relevant information from the message
    const chatId = message.chat.id;
    const messageIdTelegram = message.message_id;
    const fileId = message.photo ? message.photo[message.photo.length - 1].file_id
      : message.video ? message.video.file_id
      : message.document ? message.document.file_id : null;
    const fileUniqueId = message.photo ? message.photo[message.photo.length - 1].file_unique_id
      : message.video ? message.video.file_unique_id
      : message.document ? message.document.file_unique_id : null;
    const fileSize = message.photo ? message.photo[message.photo.length - 1].file_size
      : message.video ? message.video.file_size
      : message.document ? message.document.file_size : null;
    const width = message.photo ? message.photo[message.photo.length - 1].width
      : message.video ? message.video.width : null;
    const height = message.photo ? message.photo[message.photo.length - 1].height
      : message.video ? message.video.height : null;
    const duration = message.video ? message.video.duration : null;
    const mimeType = message.video ? message.video.mime_type : message.document ? message.document.mime_type : null;
    const telegramDate = new Date(message.date * 1000).toISOString();
    
    // Log media details
    logger.info('Processing media message', {
      message_id: messageIdTelegram,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_size: fileSize,
      width: width,
      height: height,
      duration: duration,
      mime_type: mimeType,
      telegram_date: telegramDate
    });
    
    // Construct the file URL
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const fileUrl = botToken && fileId ? `https://api.telegram.org/file/bot${botToken}/${fileId}` : null;
    
    // Prepare the message data for database insertion
    const messageData = {
      telegram_message_id: messageIdTelegram,
      chat_id: chatId,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_size: fileSize,
      width: width,
      height: height,
      duration: duration,
      mime_type: mimeType,
      telegram_date: telegramDate,
      message_type: 'media',
      from_id: message.from?.id,
      is_bot: message.from?.is_bot,
      is_forward: isForwarded,
      media_group_id: message.media_group_id,
      caption: message.caption,
      telegram_data: message,
      message_url: `https://t.me/${message.chat.username}/${message.message_id}`,
      processing_state: 'pending'
    };
    
    // Insert the message into the database
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select('id')
      .single();
    
    if (error) {
      logger.error('Error inserting message into database', {
        message_id: messageIdTelegram,
        error: error.message
      });
      throw new Error(`Database insert error: ${error.message}`);
    }
    
    // Get the message ID from the database response
    const messageId = data.id;
    
    // If message has a caption, process it immediately
    if (message.caption) {
      logger.info(`Media message has caption, initiating immediate processing`, {
        caption_length: message.caption.length,
        message_id: messageId,
        media_group_id: message.media_group_id
      });
      
      // Process the caption immediately
      try {
        const captionResult = await processMessageCaptionDirect(
          messageId, 
          correlationId,
          logger
        );
        
        if (captionResult.success) {
          logger.info(`Successfully processed caption for message ${messageId}`);
        } else {
          logger.warn(`Caption processing returned error for message ${messageId}: ${captionResult.error}`);
        }
      } catch (captionError) {
        // Log but don't fail the whole request
        logger.error(`Failed to process caption: ${captionError.message}`, {
          message_id: messageId
        });
      }
      
      // If it's part of a media group, also schedule a delayed sync
      if (message.media_group_id) {
        try {
          const syncResult = await scheduleMediaGroupSyncDirect(
            messageId,
            message.media_group_id,
            correlationId,
            logger
          );
          
          if (syncResult.success) {
            logger.info(`Successfully scheduled media group sync for group ${message.media_group_id}`);
          } else {
            logger.warn(`Media group sync scheduling returned error: ${syncResult.error}`);
          }
        } catch (syncError) {
          // Log but don't fail the whole request
          logger.error(`Failed to schedule media group sync: ${syncError.message}`, {
            message_id: messageId,
            media_group_id: message.media_group_id
          });
        }
      }
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        id: messageId,
        processing_time_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error(`Error handling media message: ${error.message}`, {
      message_id: message.message_id,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

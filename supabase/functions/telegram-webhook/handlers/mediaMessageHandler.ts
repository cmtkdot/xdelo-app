
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
    
    // Check for duplicate message to prevent redundant inserts
    const { data: existingMessages, error: checkError } = await supabase
      .from('messages')
      .select('id')
      .eq('telegram_message_id', messageIdTelegram)
      .eq('chat_id', chatId)
      .limit(1);
      
    if (checkError) {
      logger.warn('Error checking for duplicate message:', {
        error: checkError.message
      });
    } else if (existingMessages && existingMessages.length > 0) {
      logger.info('Duplicate message detected, skipping insert', {
        message_id: messageIdTelegram,
        existing_id: existingMessages[0].id
      });
      
      // Return success with existing message ID
      return new Response(
        JSON.stringify({
          success: true,
          id: existingMessages[0].id,
          duplicate: true,
          processing_time_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare the message data for database insertion
    // Include only essential fields to reduce insert time
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
      is_bot: message.from?.is_bot ? true : false, // Ensure boolean type
      is_forward: isForwarded,
      media_group_id: message.media_group_id,
      caption: message.caption,
      // Store minimal telegram data to reduce payload size
      telegram_data: {
        message_id: message.message_id,
        from: message.from,
        chat: message.chat,
        date: message.date,
        media_group_id: message.media_group_id,
        caption: message.caption,
        photo: message.photo,
        video: message.video,
        document: message.document
      },
      message_url: `https://t.me/${message.chat.username}/${message.message_id}`,
      processing_state: 'pending',
      correlation_id: correlationId
    };
    
    // Set timeout to avoid long-running transactions
    const timeoutMs = 5000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Insert operation timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    
    // Perform the insert with timeout protection
    const insertPromise = supabase
      .from('messages')
      .insert([messageData])
      .select('id')
      .single();
      
    // Race between the insert operation and timeout
    const { data, error } = await Promise.race([
      insertPromise,
      timeoutPromise.then(() => ({ data: null, error: { message: `Insert operation timed out after ${timeoutMs}ms` } }))
    ]) as any;
    
    if (error) {
      logger.error('Error inserting message into database', {
        message_id: messageIdTelegram,
        error: error.message
      });
      
      // If it's a timeout, attempt a minimal insert instead
      if (error.message.includes('timeout')) {
        logger.warn('Attempting minimal insert after timeout', {
          message_id: messageIdTelegram
        });
        
        // Create minimal version of the message data
        const minimalData = {
          telegram_message_id: messageIdTelegram,
          chat_id: chatId,
          file_unique_id: fileUniqueId,
          caption: message.caption,
          media_group_id: message.media_group_id,
          processing_state: 'pending',
          correlation_id: correlationId
        };
        
        // Try the minimal insert
        const { data: minData, error: minError } = await supabase
          .from('messages')
          .insert([minimalData])
          .select('id')
          .single();
          
        if (minError) {
          throw new Error(`Database insert error (minimal): ${minError.message}`);
        }
        
        // Use the ID from minimal insert
        data = minData;
      } else {
        throw new Error(`Database insert error: ${error.message}`);
      }
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
      
      // Process the caption immediately but don't wait for completion
      processMessageCaptionDirect(messageId, correlationId, logger)
        .then(result => {
          if (result.success) {
            logger.info(`Successfully processed caption for message ${messageId}`);
          } else {
            logger.warn(`Caption processing returned error for message ${messageId}: ${result.error}`);
          }
        })
        .catch(error => {
          logger.error(`Failed to process caption: ${error.message}`, {
            message_id: messageId
          });
        });
      
      // If it's part of a media group, also schedule a delayed sync
      if (message.media_group_id) {
        scheduleMediaGroupSyncDirect(messageId, message.media_group_id, correlationId, logger)
          .then(result => {
            if (result.success) {
              logger.info(`Successfully scheduled media group sync for group ${message.media_group_id}`);
            } else {
              logger.warn(`Media group sync scheduling returned error: ${result.error}`);
            }
          })
          .catch(error => {
            logger.error(`Failed to schedule media group sync: ${error.message}`, {
              message_id: messageId,
              media_group_id: message.media_group_id
            });
          });
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

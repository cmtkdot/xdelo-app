import { corsHeaders } from "../../utils/cors.ts";
import { supabaseClient } from "../../utils/supabase.ts";
import { xdelo_processMessageMedia } from "../../utils/media/mediaStorage.ts";
import { hasCaption, extractCaption } from "../../utils/messageUtils.ts";
import { xdelo_logProcessingEvent } from "../../utils/databaseOperations.ts";

/**
 * Handle new media messages
 */
export async function handleNewMediaMessage(message: any, context: any) {
  try {
    const { isChannelPost, isForwarded, correlationId, logger } = context;
    
    // Basic message parameters
    const telegramMessageId = message.message_id;
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const chatTitle = message.chat.title;
    const fileId = message.photo ? message.photo[message.photo.length - 1].file_id :
                   message.video ? message.video.file_id :
                   message.document ? message.document.file_id : null;
    const fileUniqueId = message.photo ? message.photo[message.photo.length - 1].file_unique_id :
                         message.video ? message.video.file_unique_id :
                         message.document ? message.document.file_unique_id : null;
    const fileSize = message.photo ? message.photo[message.photo.length - 1].file_size :
                     message.video ? message.video.file_size :
                     message.document ? message.document.file_size : null;
    const captionText = extractCaption(message);
    
    logger.info("Processing new media message", {
      message_id: telegramMessageId,
      chat_id: chatId,
      has_caption: hasCaption(message),
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_size: fileSize
    });
    
    // Ensure required parameters are present
    if (!fileId || !fileUniqueId) {
      logger.error("Missing file_id or file_unique_id", {
        message_id: telegramMessageId,
        file_id: fileId,
        file_unique_id: fileUniqueId
      });
      
      return new Response(
        JSON.stringify({ error: "Missing file_id or file_unique_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get Telegram bot token from environment variables
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!telegramBotToken) {
      logger.error("Telegram bot token not found in environment variables");
      return new Response(
        JSON.stringify({ error: "Telegram bot token not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Step 1: Process the media (download, store, etc.)
    const mediaResult = await xdelo_processMessageMedia(
      message,
      fileId,
      fileUniqueId,
      telegramBotToken,
      telegramMessageId,
      correlationId
    );
    
    if (!mediaResult.success) {
      logger.error("Media processing failed", {
        message_id: telegramMessageId,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        error: mediaResult.error
      });
      
      return new Response(
        JSON.stringify({ error: `Media processing failed: ${mediaResult.error}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Media processing completed", {
      message_id: telegramMessageId,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url
    });
    
    // Step 2: Store message metadata in the database
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: telegramMessageId,
        chat_id: chatId,
        chat_type: chatType,
        chat_title: chatTitle,
        media_group_id: message.media_group_id || null,
        caption: captionText,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        mime_type: mediaResult.fileInfo.mime_type,
        file_size: mediaResult.fileInfo.file_size,
        width: message.photo ? message.photo[message.photo.length - 1].width : message.video ? message.video.width : null,
        height: message.photo ? message.photo[message.photo.length - 1].height : message.video ? message.video.height : null,
        duration: message.video ? message.video.duration : null,
        storage_path: mediaResult.fileInfo.storage_path,
        public_url: mediaResult.fileInfo.public_url,
        content_disposition: 'inline', // Default
        processing_state: 'pending',
        telegram_data: message,
        is_forward: isForwarded,
        correlation_id: correlationId
      })
      .select()
      .single();
    
    if (error) {
      logger.error("Database insert failed", {
        message_id: telegramMessageId,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        error: error.message
      });
      
      return new Response(
        JSON.stringify({ error: `Database insert failed: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Message metadata stored in database", {
      message_id: telegramMessageId,
      database_id: data.id,
      file_id: fileId,
      file_unique_id: fileUniqueId
    });
    
    // Step 3: Log successful processing event
    await xdelo_logProcessingEvent(
      "new_media_message_processed",
      data.id,
      correlationId,
      {
        message_id: telegramMessageId,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        storage_path: mediaResult.fileInfo.storage_path,
        public_url: mediaResult.fileInfo.public_url
      }
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Media message processed successfully",
        messageId: data.id,
        hasCaption: hasCaption(message),
        mediaGroupId: message.media_group_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error handling new media message:", error);
    
    return new Response(
      JSON.stringify({ error: `Error handling new media message: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

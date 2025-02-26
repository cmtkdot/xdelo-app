
import { createClient } from "@supabase/supabase-js";
import { TelegramMessage, TelegramWebhookPayload, MessageHandlerContext, ProcessedMessageResult } from "./types.ts";
import { downloadMedia, uploadMediaToStorage, extractMediaInfo } from "./mediaUtils.ts";

export async function handleMessage(
  payload: TelegramWebhookPayload,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  const { logger } = context;
  const message = payload.message || payload.channel_post;
  
  logger.info('📨 Processing new message', { 
    messageId: message?.message_id,
    chatId: message?.chat?.id,
    hasPhoto: !!message?.photo,
    hasVideo: !!message?.video,
    hasDocument: !!message?.document,
    hasCaption: !!message?.caption,
    mediaGroupId: message?.media_group_id
  });

  if (!message) {
    logger.error('No message found in payload');
    return { success: false, error: 'No message found in payload' };
  }

  try {
    if (message.photo || message.video || message.document) {
      logger.info('🖼️ Handling media message');
      return await handleMediaMessage(message, context);
    } else {
      logger.info('📝 Handling text message');
      return await handleTextMessage(message, context);
    }
  } catch (error) {
    logger.error('Error processing message:', error);
    return { success: false, error: error.message };
  }
}

async function handleMediaMessage(
  message: TelegramMessage,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  const { logger } = context;
  
  const mediaInfo = extractMediaInfo(message);
  if (!mediaInfo) {
    logger.error('No media info found in message');
    return { success: false, error: 'No media info found' };
  }

  logger.info('📸 Media info extracted', mediaInfo);

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not found');
    }

    // Check if media already exists
    const { data: existingMedia } = await context.supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', mediaInfo.file_unique_id)
      .single();

    if (existingMedia) {
      logger.info('♻️ Media already exists in storage', { 
        messageId: existingMedia.id,
        fileUniqueId: mediaInfo.file_unique_id 
      });
      return { success: true, messageId: existingMedia.id };
    }

    logger.info('⬇️ Downloading media from Telegram', { fileId: mediaInfo.file_id });
    const fileData = await downloadMedia(mediaInfo.file_id, botToken, logger);
    
    logger.info('⬆️ Uploading media to storage', { 
      storagePath: mediaInfo.storage_path,
      mimeType: mediaInfo.mime_type 
    });
    
    const publicUrl = await uploadMediaToStorage(
      fileData,
      mediaInfo.storage_path,
      mediaInfo.mime_type,
      context
    );

    logger.info('💾 Saving message to database');
    const { data, error } = await context.supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        media_group_id: message.media_group_id,
        caption: message.caption,
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        public_url: publicUrl,
        mime_type: mediaInfo.mime_type,
        file_size: mediaInfo.file_size,
        width: mediaInfo.width,
        height: mediaInfo.height,
        duration: mediaInfo.duration,
        processing_state: message.caption ? 'pending' : 'initialized',
        correlation_id: context.correlationId
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert message', error);
      throw error;
    }

    logger.info('✅ Message processed successfully', { 
      messageId: data.id,
      publicUrl 
    });

    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error('Error handling media message:', error);
    return { success: false, error: error.message };
  }
}

async function handleTextMessage(
  message: TelegramMessage,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  const { logger } = context;
  
  try {
    logger.info('💬 Processing text message', { 
      messageId: message.message_id,
      chatId: message.chat.id 
    });

    const { data, error } = await context.supabaseClient
      .from('other_messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_text: message.text,
        processing_state: 'initialized',
        correlation_id: context.correlationId
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert text message', error);
      throw error;
    }

    logger.info('✅ Text message saved successfully', { messageId: data.id });
    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error('Error handling text message:', error);
    return { success: false, error: error.message };
  }
}

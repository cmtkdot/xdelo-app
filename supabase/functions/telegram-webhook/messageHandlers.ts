import { createClient } from "@supabase/supabase-js";
import { TelegramMessage, TelegramWebhookPayload, MessageHandlerContext, ProcessedMessageResult } from "./types.ts";
import { downloadMedia, uploadMediaToStorage, getMimeType, getStoragePath, extractMediaInfo } from "./mediaUtils.ts";
import { insertMediaMessage, insertTextMessage, updateMessageGroupInfo } from "./dbOperations.ts";
import { getLogger } from "./logger.ts";

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function handleMessage(
  payload: TelegramWebhookPayload,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  const message = payload.message || payload.channel_post;
  
  if (!message) {
    context.logger.error('No message found in payload');
    return { success: false, error: 'No message found in payload' };
  }

  try {
    if (message.photo || message.video || message.document) {
      return await handleMediaMessage(message, context);
    } else {
      return await handleTextMessage(message, context);
    }
  } catch (error) {
    context.logger.error('Error processing message:', error);
    return { success: false, error: error.message };
  }
}

async function handleMediaMessage(
  message: TelegramMessage,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  const mediaInfo = await extractMediaInfo(message);
  if (!mediaInfo) {
    return { success: false, error: 'No media info found' };
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not found');
    }

    const fileData = await downloadMedia(mediaInfo.file_id, botToken);
    const publicUrl = await uploadMediaToStorage(
      fileData, 
      mediaInfo.storage_path,
      mediaInfo.mime_type,
      context
    );

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

    if (error) throw error;

    return { success: true, messageId: data.id };
  } catch (error) {
    context.logger.error('Error handling media message:', error);
    return { success: false, error: error.message };
  }
}

async function handleTextMessage(
  message: TelegramMessage,
  context: MessageHandlerContext
): Promise<ProcessedMessageResult> {
  try {
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

    if (error) throw error;

    return { success: true, messageId: data.id };
  } catch (error) {
    context.logger.error('Error handling text message:', error);
    return { success: false, error: error.message };
  }
}

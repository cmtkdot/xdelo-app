
import { SupabaseClient } from "@supabase/supabase-js";
import { TelegramMessage } from "./types.ts";
import { FunctionInvocationContext } from "./types.ts";

export async function insertMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  publicUrl: string,
  mediaInfo: any,
  context: FunctionInvocationContext
) {
  const { data, error } = await supabase
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
    context.logger.error('Error inserting media message:', error);
    throw error;
  }

  return data;
}

export async function insertTextMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  context: FunctionInvocationContext
) {
  const { data, error } = await supabase
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
    context.logger.error('Error inserting text message:', error);
    throw error;
  }

  return data;
}

export async function updateMessageGroupInfo(
  supabase: SupabaseClient,
  mediaGroupId: string,
  context: FunctionInvocationContext
) {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  if (error) {
    context.logger.error('Error fetching media group messages:', error);
    throw error;
  }

  if (messages.length > 0) {
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    // Update all messages in the group with group timing information
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        group_first_message_time: firstMessage.created_at,
        group_last_message_time: lastMessage.created_at
      })
      .eq('media_group_id', mediaGroupId);

    if (updateError) {
      context.logger.error('Error updating media group info:', updateError);
      throw updateError;
    }
  }

  return messages;
}

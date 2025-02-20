
import { SupabaseClient } from '@supabase/supabase-js';
import { TelegramMessage } from './types.ts';
import { downloadMedia, extractMediaInfo } from './mediaUtils.ts';

export async function deduplicateMessage(
  supabase: SupabaseClient,
  message: TelegramMessage
): Promise<boolean> {
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  return !!existingMessage;
}

export async function handleMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  chatInfo: { chat_id: number; chat_type: string; chat_title: string }
) {
  try {
    // Extract media info if present
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('No media found in message');
      return null;
    }

    // Prepare base message data
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      chat_type: chatInfo.chat_type,
      chat_title: chatInfo.chat_title,
      caption: message.caption || '',
      media_group_id: message.media_group_id || null,
      telegram_data: message,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
    };

    // Insert message into database
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log('Message inserted successfully:', insertedMessage.id);

    // Download media if present
    if (mediaInfo.file_id) {
      const downloadResult = await downloadMedia(
        supabase,
        mediaInfo,
        insertedMessage.id
      );
      console.log('Media download result:', downloadResult);
    }

    return insertedMessage;
  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}

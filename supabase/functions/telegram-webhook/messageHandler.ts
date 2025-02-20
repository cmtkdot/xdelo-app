
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
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

export function extractChatInfo(message: TelegramMessage) {
  let chatTitle = '';
  
  // Handle different chat types appropriately
  if (message.chat.type === 'channel' || message.chat.type === 'group' || message.chat.type === 'supergroup') {
    chatTitle = message.chat.title || 'Unnamed Group';
  } else if (message.chat.type === 'private') {
    // For private chats, construct name from components
    const parts = [
      message.chat.first_name,
      message.chat.last_name,
      message.chat.username ? `(@${message.chat.username})` : null
    ].filter(Boolean);
    chatTitle = parts.length > 0 ? parts.join(' ') : 'Unknown User';
  } else {
    chatTitle = 'Unknown Chat';
  }

  return {
    chat_id: message.chat.id,
    chat_type: message.chat.type,
    chat_title: chatTitle
  };
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

    const processedChatInfo = extractChatInfo(message);
    console.log('Processed chat info:', processedChatInfo);

    // Prepare base message data
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: processedChatInfo.chat_id,
      chat_type: processedChatInfo.chat_type,
      chat_title: processedChatInfo.chat_title, // Using properly processed chat title
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
      processing_state: message.caption ? 'pending' : 'initialized'
    };

    // Insert message into database
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
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

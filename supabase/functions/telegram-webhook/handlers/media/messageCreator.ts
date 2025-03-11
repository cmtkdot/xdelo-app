
import { supabaseClient } from '../../../_shared/supabase.ts';
import { TelegramMessage, MessageContext, MessageInput } from '../../types';
import { MediaInfo } from './types';
import { extractForwardInfo } from './forwardUtils';

export async function createMessageRecord(
  message: TelegramMessage,
  mediaInfo: MediaInfo,
  context: MessageContext
): Promise<string> {
  const messageInput: MessageInput = {
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    chat_type: message.chat.type,
    chat_title: message.chat.title,
    media_group_id: message.media_group_id,
    caption: message.caption,
    file_id: mediaInfo.file_id,
    file_unique_id: mediaInfo.file_unique_id,
    mime_type: mediaInfo.mime_type,
    file_size: mediaInfo.file_size,
    width: mediaInfo.width,
    height: mediaInfo.height,
    duration: mediaInfo.duration,
    telegram_data: message,
    correlation_id: context.correlationId,
    processing_state: message.caption ? 'pending' : 'no_caption',
    storage_path: mediaInfo.storage_path,
    public_url: mediaInfo.public_url,
    needs_redownload: mediaInfo.needs_redownload || false,
    forward_info: extractForwardInfo(message)
  };

  const { data: newMessage, error: insertError } = await supabaseClient
    .from('messages')
    .insert(messageInput)
    .select()
    .single();

  if (insertError) throw insertError;
  
  return newMessage.id;
}

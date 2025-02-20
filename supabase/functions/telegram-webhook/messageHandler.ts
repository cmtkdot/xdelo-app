
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { TelegramMessage } from './types.ts';
import { downloadMedia, extractMediaInfo } from './mediaUtils.ts';

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<any> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('file_unique_id', fileUniqueId)
    .maybeSingle();

  if (error) {
    console.error('Error finding existing message:', error);
    return null;
  }

  return data;
}

export async function findAnalyzedGroupMessage(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<any> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .is('analyzed_content', 'NOT NULL')
    .eq('processing_state', 'completed')
    .maybeSingle();

  if (error) {
    console.error('Error finding analyzed group message:', error);
    return null;
  }

  return data;
}

export function extractChatInfo(message: TelegramMessage) {
  let chatTitle = '';
  
  if (message.chat.type === 'channel' || message.chat.type === 'group' || message.chat.type === 'supergroup') {
    chatTitle = message.chat.title || 'Unnamed Group';
  } else if (message.chat.type === 'private') {
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
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('No media found in message');
      return null;
    }

    const processedChatInfo = extractChatInfo(message);
    console.log('Processed chat info:', processedChatInfo);

    // Check for existing message by file_unique_id
    const existingMessage = await findExistingMessage(supabase, mediaInfo.file_unique_id);
    
    // Determine initial processing state
    let initialProcessingState = 'initialized';
    let isOriginalCaption = false;

    if (message.caption) {
      initialProcessingState = 'pending';
      isOriginalCaption = true;
    } else if (message.media_group_id) {
      // Check if there's an already analyzed message in the group
      const analyzedGroupMessage = await findAnalyzedGroupMessage(supabase, message.media_group_id);
      if (analyzedGroupMessage) {
        initialProcessingState = 'completed';
        isOriginalCaption = false;
      }
    }

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: processedChatInfo.chat_id,
      chat_type: processedChatInfo.chat_type,
      chat_title: processedChatInfo.chat_title,
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
      processing_state: initialProcessingState,
      is_original_caption: isOriginalCaption,
      group_caption_synced: false,
      analyzed_content: null // Will be updated by parse-caption-with-ai function if needed
    };

    let result;
    if (existingMessage) {
      // Update existing message
      const { data, error } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating existing message:', error);
        throw error;
      }
      result = data;
    } else {
      // Insert new message
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('Error inserting new message:', error);
        throw error;
      }
      result = data;
    }

    console.log('Message processed successfully:', result.id);

    // Download media if present
    if (mediaInfo.file_id) {
      const downloadResult = await downloadMedia(
        supabase,
        mediaInfo,
        result.id
      );
      console.log('Media download result:', downloadResult);
    }

    return result;
  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}

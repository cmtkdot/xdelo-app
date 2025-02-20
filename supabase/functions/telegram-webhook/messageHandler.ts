
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { TelegramMessage, ChatInfo } from "./types.ts";
import { extractMediaInfo, downloadMedia } from "./mediaUtils.ts";

export function extractChatInfo(message: TelegramMessage): ChatInfo {
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

async function findExistingMessage(
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

async function findAnalyzedGroupMessage(
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

export async function handleMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  chatInfo: ChatInfo
) {
  try {
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('No media found in message');
      return null;
    }

    // Check for existing message by file_unique_id
    const existingMessage = await findExistingMessage(supabase, mediaInfo.file_unique_id);
    
    // Check for analyzed content in media group
    let analyzedGroupMessage = null;
    if (message.media_group_id) {
      analyzedGroupMessage = await findAnalyzedGroupMessage(supabase, message.media_group_id);
    }

    // Determine initial state and flags
    const initialState = message.caption ? 'pending' : 
                        (analyzedGroupMessage ? 'pending' : 'initialized');
    
    const isOriginalCaption = Boolean(message.caption);

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
      processing_state: initialState,
      is_original_caption: isOriginalCaption,
      group_caption_synced: Boolean(analyzedGroupMessage),
      analyzed_content: analyzedGroupMessage?.analyzed_content || null
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

      if (error) throw error;
      result = data;
    } else {
      // Insert new message
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Download and store media
    if (mediaInfo.file_id) {
      await downloadMedia(supabase, mediaInfo, result.id);
    }

    // If this message has analyzed content from group, sync it
    if (analyzedGroupMessage && message.media_group_id) {
      await supabase.rpc('xdelo_process_media_group_content', {
        p_message_id: result.id,
        p_media_group_id: message.media_group_id,
        p_analyzed_content: analyzedGroupMessage.analyzed_content
      });
    }

    return result;

  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}

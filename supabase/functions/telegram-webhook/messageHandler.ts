
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

async function findAnalyzedGroupMessage(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<any> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .eq('processing_state', 'completed')
    .is('analyzed_content', 'not.null')
    .order('created_at', { ascending: false })
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
    console.log('Processing message:', {
      message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('No media found in message');
      return null;
    }

    // For messages without caption in a media group, try to find analyzed content
    let analyzedGroupMessage = null;
    if (!message.caption && message.media_group_id) {
      analyzedGroupMessage = await findAnalyzedGroupMessage(supabase, message.media_group_id);
      console.log('Found analyzed group message:', !!analyzedGroupMessage);
    }

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
      analyzed_content: analyzedGroupMessage?.analyzed_content || null,
      group_caption_synced: Boolean(analyzedGroupMessage?.analyzed_content)
    };

    // Upsert message - create or update based on file_unique_id
    console.log('Upserting message with file_unique_id:', mediaInfo.file_unique_id);
    const { data: result, error } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'file_unique_id',
        returning: 'representation'
      })
      .select()
      .single();

    if (error) throw error;

    // Download and store media
    if (mediaInfo.file_id) {
      console.log('Downloading media for message:', result.id);
      const publicUrl = await downloadMedia(supabase, mediaInfo, result.id);
      if (publicUrl) {
        console.log('Media downloaded successfully:', publicUrl);
      }
    }

    // If this message has caption, analyze and sync with media group
    if (message.caption && message.media_group_id) {
      console.log('Message has caption, will be analyzed and synced with group');
    }
    // If we found analyzed content from group, sync it
    else if (analyzedGroupMessage?.analyzed_content && message.media_group_id) {
      console.log('Syncing media group content');
      const { error: syncError } = await supabase.rpc('xdelo_process_media_group_content', {
        p_message_id: analyzedGroupMessage.id,
        p_media_group_id: message.media_group_id,
        p_analyzed_content: analyzedGroupMessage.analyzed_content
      });

      if (syncError) {
        console.error('Error syncing media group:', syncError);
      } else {
        console.log('Media group synced successfully');
      }
    }

    return result;

  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}


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
  fileUniqueId: string,
  messageId: number,
  chatId: number
): Promise<any> {
  // First try to find by file_unique_id
  const { data: fileData, error: fileError } = await supabase
    .from('messages')
    .select('*')
    .eq('file_unique_id', fileUniqueId)
    .maybeSingle();

  if (fileError) {
    console.error('Error finding message by file_unique_id:', fileError);
    return null;
  }

  if (fileData) {
    console.log('Found existing message by file_unique_id:', fileData.id);
    return fileData;
  }

  // If not found by file_unique_id, try telegram_message_id and chat_id
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('telegram_message_id', messageId)
    .eq('chat_id', chatId)
    .maybeSingle();

  if (messageError) {
    console.error('Error finding message by telegram_message_id:', messageError);
    return null;
  }

  if (messageData) {
    console.log('Found existing message by telegram_message_id:', messageData.id);
  }

  return messageData;
}

async function findAnalyzedGroupMessage(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<any> {
  // Look for the most recently analyzed message in the group
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

  if (data) {
    console.log('Found analyzed group message:', {
      id: data.id,
      media_group_id: data.media_group_id,
      has_content: !!data.analyzed_content
    });
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

    // Find existing message using both file_unique_id and telegram_message_id
    const existingMessage = await findExistingMessage(
      supabase, 
      mediaInfo.file_unique_id,
      message.message_id,
      chatInfo.chat_id
    );
    
    // Only check for analyzed group message if this is a new message or part of a group
    let analyzedGroupMessage = null;
    if ((!existingMessage || !existingMessage.analyzed_content) && message.media_group_id) {
      analyzedGroupMessage = await findAnalyzedGroupMessage(supabase, message.media_group_id);
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
      is_original_caption: Boolean(message.caption),
      group_caption_synced: Boolean(analyzedGroupMessage?.analyzed_content)
    };

    // Only set analyzed_content if we have it from the group
    if (analyzedGroupMessage?.analyzed_content) {
      messageData.analyzed_content = analyzedGroupMessage.analyzed_content;
    }

    let result;
    if (existingMessage) {
      console.log('Updating existing message:', existingMessage.id);
      const { data, error } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('Message updated successfully:', result.id);
    } else {
      console.log('Creating new message');
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('New message created:', result.id);
    }

    // Download and store media
    if (mediaInfo.file_id) {
      console.log('Downloading media for message:', result.id);
      const publicUrl = await downloadMedia(supabase, mediaInfo, result.id);
      if (publicUrl) {
        console.log('Media downloaded successfully:', publicUrl);
      }
    }

    // Sync media group content if we have an analyzed message
    if (analyzedGroupMessage?.analyzed_content && message.media_group_id) {
      console.log('Syncing media group content from message:', analyzedGroupMessage.id);
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

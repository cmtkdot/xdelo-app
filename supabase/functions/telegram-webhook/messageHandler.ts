import { SupabaseClient } from "@supabase/supabase-js";
import { extractMediaInfo, downloadMedia } from "./mediaUtils.ts";
import { 
  TelegramMessage, 
  ChatInfo, 
  WebhookResponse,
  ExistingMessage,
  MessageData
} from "./types.ts";

export function extractChatInfo(message: TelegramMessage): ChatInfo {
  let chatTitle = '';
  const chatType = message.chat.type;
  
  // Validate and normalize chat type
  if (!['private', 'group', 'supergroup', 'channel'].includes(chatType)) {
    console.warn('⚠️ Unknown chat type:', chatType);
  }
  
  // Extract chat title based on type
  if (chatType === 'channel' || chatType === 'group' || chatType === 'supergroup') {
    chatTitle = message.chat.title || 'Unnamed Group/Channel';
  } else if (chatType === 'private') {
    const parts = [
      message.chat.first_name,
      message.chat.last_name,
      message.chat.username && `@${message.chat.username}`
    ].filter(Boolean);
    chatTitle = parts.join(' ');
  }

  return {
    chat_id: message.chat.id,
    chat_type: chatType,
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
): Promise<WebhookResponse> {
  const correlationId = crypto.randomUUID();
  const isEdit = !!message.edit_date;

  try {
    console.log('📝 Processing message:', {
      correlation_id: correlationId,
      message_id: message.message_id,
      chat_type: chatInfo.chat_type,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
      is_edit: isEdit
    });

    // Handle text-only messages
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('📄 Processing text-only message');
      
      const { error: insertError } = await supabase.from("other_messages").insert({
        user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
        message_type: "text",
        telegram_message_id: message.message_id,
        chat_id: chatInfo.chat_id,
        chat_type: chatInfo.chat_type,
        chat_title: chatInfo.chat_title,
        message_text: message.text || message.caption || "",
        telegram_data: { message },
        processing_state: "completed",
        is_edited: isEdit,
        edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null
      });

      if (insertError) throw insertError;

      return {
        message: "Text message processed",
      };
    }

    // Check for existing message with same file_unique_id
    const { data: existingMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", mediaInfo.file_unique_id)
      .eq("telegram_message_id", message.message_id)
      .maybeSingle();

    // Get the last analyzed message in the media group
    let analyzedGroupMessage: ExistingMessage | null = null;
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("media_group_id", message.media_group_id)
        .not("analyzed_content", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      analyzedGroupMessage = groupMessages;
    }

    // Get group message count and timing info
    let groupMessageCount = 0;
    let groupFirstMessageTime = null;
    let groupLastMessageTime = null;

    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from("messages")
        .select("created_at")
        .eq("media_group_id", message.media_group_id)
        .order("created_at", { ascending: true });

      if (groupMessages && groupMessages.length > 0) {
        groupMessageCount = groupMessages.length;
        groupFirstMessageTime = groupMessages[0].created_at;
        groupLastMessageTime = groupMessages[groupMessages.length - 1].created_at;
      }
    }

    // Prepare message data
    const messageData: MessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      chat_type: chatInfo.chat_type,
      chat_title: chatInfo.chat_title,
      media_group_id: message.media_group_id || null,
      caption: message.caption,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      telegram_data: { message },
      group_message_count: groupMessageCount,
      group_first_message_time: groupFirstMessageTime,
      group_last_message_time: groupLastMessageTime,
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null,
      processing_state: message.caption || analyzedGroupMessage?.analyzed_content ? 'pending' : 'initialized',
      group_caption_synced: Boolean(analyzedGroupMessage?.analyzed_content)
    };

    // If there's an analyzed message in the group, copy its content
    if (analyzedGroupMessage?.analyzed_content) {
      messageData.analyzed_content = analyzedGroupMessage.analyzed_content;
      messageData.processing_state = 'completed';
    }

    let result;
    if (existingMessages) {
      console.log('🔄 Updating existing message:', existingMessages.id);
      
      const { error: updateError } = await supabase
        .from("messages")
        .update(messageData)
        .eq("id", existingMessages.id)
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

    return {
      message: "Media message processed",
      processed_media: [{
        file_unique_id: mediaInfo.file_unique_id,
        public_url: publicUrl || ''
      }]
    };

  } catch (error) {
    console.error('❌ Error processing message:', {
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}

async function triggerCaptionParsing(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string | undefined,
  caption: string,
  isEdit: boolean
): Promise<void> {
  // Implementation for caption parsing
  console.log('🔍 Triggering caption parsing:', {
    message_id: messageId,
    media_group_id: mediaGroupId,
    is_edit: isEdit
  });
}

async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  targetMessageId: string,
  mediaGroupId: string
): Promise<void> {
  // Implementation for media group content synchronization
  console.log('🔄 Syncing media group content:', {
    source_message_id: sourceMessageId,
    target_message_id: targetMessageId,
    media_group_id: mediaGroupId
  });
}

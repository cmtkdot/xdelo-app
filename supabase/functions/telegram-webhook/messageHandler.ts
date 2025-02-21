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

      if (updateError) throw updateError;
      result = { id: existingMessages.id };

    } else {
      console.log('➕ Creating new message');
      
      const { data: insertedMessage, error: insertError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      result = insertedMessage;
    }

    // Download and upload media
    const publicUrl = await downloadMedia(supabase, mediaInfo, result.id);
    if (publicUrl) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ public_url: publicUrl })
        .eq("id", result.id);

      if (updateError) throw updateError;
    }

    // Handle caption and group synchronization
    if (message.caption) {
      // If this message has a caption, trigger parsing
      await triggerCaptionParsing(
        supabase,
        result.id,
        message.media_group_id,
        message.caption,
        isEdit
      );
    } else if (analyzedGroupMessage?.analyzed_content && message.media_group_id) {
      // If no caption but part of an analyzed group, sync the content
      await syncMediaGroupContent(
        supabase,
        analyzedGroupMessage.id,
        result.id,
        message.media_group_id
      );
    }

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

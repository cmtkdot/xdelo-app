import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { TelegramMessage, ChatInfo, WebhookResponse } from "./types.ts";
import { extractMediaInfo, downloadMedia } from "./mediaUtils.ts";
import { 
  findExistingMessage, 
  findAnalyzedGroupMessage, 
  createNewMessage, 
  updateExistingMessage,
  triggerCaptionParsing,
  syncMediaGroupContent,
  getGroupMetadata
} from "./dbOperations.ts";

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
      message.chat.username ? `(@${message.chat.username})` : null
    ].filter(Boolean);
    chatTitle = parts.length > 0 ? parts.join(' ') : 'Unknown User';
  } else {
    chatTitle = 'Unknown Chat';
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
      chat_id: chatInfo.chat_id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
      is_edit: isEdit
    });

    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('ℹ️ No media found, storing in other_messages:', {
        correlation_id: correlationId
      });
      
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
      return { message: "Non-media message stored" };
    }

    // Get group metadata first if this is a media group message
    const { currentGroupCount, groupFirstMessageTime, groupLastMessageTime } = 
      await getGroupMetadata(supabase, message.media_group_id);

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
      is_original_caption: message.media_group_id ? currentGroupCount === 1 : true,
      group_message_count: currentGroupCount,
      group_first_message_time: groupFirstMessageTime,
      group_last_message_time: groupLastMessageTime,
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null,
      processing_state: message.caption || analyzedGroupMessage?.analyzed_content ? 'pending' : 'initialized',
      group_caption_synced: Boolean(analyzedGroupMessage?.analyzed_content)
    };

    // Only set analyzed_content if we have it from the group
    if (analyzedGroupMessage?.analyzed_content) {
      messageData.analyzed_content = analyzedGroupMessage.analyzed_content;
      messageData.processing_state = 'completed';
    }

    let result;
    if (existingMessage) {
      console.log('🔄 Updating existing message:', {
        correlation_id: correlationId,
        message_id: existingMessage.id
      });
      
      result = await updateExistingMessage(supabase, existingMessage.id, messageData, isEdit);
    } else {
      console.log('➕ Creating new message:', {
        correlation_id: correlationId
      });
      
      result = await createNewMessage(supabase, messageData);
    }

    // Download and store media
    if (mediaInfo.file_id) {
      console.log('📥 Downloading media:', {
        correlation_id: correlationId,
        message_id: result.id
      });
      
      const publicUrl = await downloadMedia(supabase, mediaInfo, result.id);
      if (publicUrl) {
        console.log('✅ Media downloaded:', {
          correlation_id: correlationId,
          url: publicUrl
        });
      }
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
        message.media_group_id,
        analyzedGroupMessage.analyzed_content
      );
    }

    return {
      message: "Media processed successfully",
      processed_media: [{
        file_unique_id: mediaInfo.file_unique_id,
        message_id: result.id,
        is_edit: isEdit,
        needs_parsing: !!message.caption,
        group_synced: !!analyzedGroupMessage?.analyzed_content
      }]
    };

  } catch (error) {
    console.error("❌ Error in handleMessage:", {
      error,
      correlation_id: correlationId,
      message_id: message.message_id
    });
    throw error;
  }
}

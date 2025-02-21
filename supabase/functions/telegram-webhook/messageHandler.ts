import { SupabaseClient } from "@supabase/supabase-js";
import { extractMediaInfo, downloadTelegramFile, uploadMedia } from "./mediaUtils";
import { 
  TelegramMessage, 
  ChatInfo, 
  WebhookResponse,
  MessageData,
  MediaInfo
} from "./types";
import {
  PROCESSING_STATES,
  ProcessingState,
  MediaGroupInfo,
  getMediaGroupInfo,
  syncMediaGroupContent
} from "../_shared/states";

export function extractChatInfo(message: TelegramMessage): ChatInfo {
  let chatTitle = '';
  const chatType = message.chat.type;
  
  if (!['private', 'group', 'supergroup', 'channel'].includes(chatType)) {
    console.warn('⚠️ Unknown chat type:', chatType);
  }
  
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

async function processMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  chatInfo: ChatInfo,
  mediaInfo: MediaInfo,
  groupInfo?: MediaGroupInfo
): Promise<{ id: string; publicUrl: string | null }> {
  const isEdit = Boolean(message.edit_date);
  const correlationId = crypto.randomUUID();
  
  // Prepare message data
  const messageData: MessageData = {
    user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
    telegram_message_id: message.message_id,
    chat_id: chatInfo.chat_id,
    chat_type: chatInfo.chat_type,
    chat_title: chatInfo.chat_title,
    media_group_id: message.media_group_id,
    caption: message.caption,
    file_id: mediaInfo.file_id,
    file_unique_id: mediaInfo.file_unique_id,
    mime_type: mediaInfo.mime_type,
    file_size: mediaInfo.file_size,
    width: mediaInfo.width,
    height: mediaInfo.height,
    duration: mediaInfo.duration,
    telegram_data: { message },
    group_message_count: groupInfo?.messageCount || 0,
    group_first_message_time: groupInfo?.firstMessageTime || null,
    group_last_message_time: groupInfo?.lastMessageTime || null,
    is_edited: isEdit,
    edit_date: isEdit && message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
    processing_state: message.caption ? PROCESSING_STATES.PENDING : PROCESSING_STATES.INITIALIZED,
    processing_correlation_id: correlationId,
    group_caption_synced: Boolean(groupInfo?.analyzedContent)
  };

  // If there's an analyzed message in the group, copy its content
  if (groupInfo?.analyzedContent) {
    messageData.analyzed_content = groupInfo.analyzedContent;
    messageData.processing_state = PROCESSING_STATES.COMPLETED;
  }

  // Check for existing message
  const { data: existingMessage } = await supabase
    .from("messages")
    .select("*")
    .eq("file_unique_id", mediaInfo.file_unique_id)
    .eq("telegram_message_id", message.message_id)
    .maybeSingle();

  let result;
  if (existingMessage) {
    const { error: updateError } = await supabase
      .from("messages")
      .update(messageData)
      .eq("id", existingMessage.id)
      .select()
      .single();

    if (updateError) throw updateError;
    result = { id: existingMessage.id };
  } else {
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;
    result = insertedMessage;
  }

  // Download and upload media
  const publicUrl = await downloadTelegramFile(supabase, mediaInfo, result.id);
  if (publicUrl) {
    await supabase.rpc('xdelo_update_message_processing_state', {
      p_message_id: result.id,
      p_state: message.caption ? PROCESSING_STATES.PENDING : PROCESSING_STATES.COMPLETED
    });
  }

  return { id: result.id, publicUrl: publicUrl || null };
}

export async function handleMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  chatInfo: ChatInfo
): Promise<WebhookResponse> {
  try {
    const correlationId = crypto.randomUUID();
    const isEdit = Boolean(message.edit_date);

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
        processing_state: PROCESSING_STATES.COMPLETED,
        is_edited: isEdit,
        edit_date: isEdit && message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
        processing_correlation_id: correlationId
      });

      if (insertError) throw insertError;

      return {
        message: "Text message processed"
      };
    }

    // Get media group info if needed
    let groupInfo: MediaGroupInfo | undefined;
    if (message.media_group_id) {
      groupInfo = await getMediaGroupInfo(supabase, message.media_group_id);
    }

    const result = await processMediaMessage(supabase, message, chatInfo, mediaInfo, groupInfo);
    
    // Handle caption and group synchronization
    if (message.caption) {
      // Trigger caption parsing via Edge Function
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          message_id: result.id,
          media_group_id: message.media_group_id,
          caption: message.caption,
          correlation_id: correlationId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger caption parsing: ${await response.text()}`);
      }
    } else if (groupInfo?.analyzedMessageId && message.media_group_id) {
      await syncMediaGroupContent(
        supabase,
        groupInfo.analyzedMessageId,
        message.media_group_id,
        correlationId
      );
    }

    return {
      message: "Media message processed",
      processed_media: [{
        file_unique_id: mediaInfo.file_unique_id,
        public_url: result.publicUrl || ""
      }]
    };

  } catch (error) {
    // Update message state to failed if we have a message ID
    if (error.messageId) {
      await supabase.rpc('xdelo_update_message_processing_state', {
        p_message_id: error.messageId,
        p_state: PROCESSING_STATES.FAILED,
        p_error: error.message
      });
    }

    console.error('❌ Error processing message:', {
      correlation_id: crypto.randomUUID(),
      error
    });
    throw error;
  }
}

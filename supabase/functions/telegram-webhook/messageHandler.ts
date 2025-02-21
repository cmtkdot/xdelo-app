import { SupabaseClient } from "@supabase/supabase-js";
import { extractMediaInfo, downloadMedia } from "./mediaUtils";
import { 
  TelegramMessage, 
  ChatInfo, 
  WebhookResponse,
  MessageData
} from "./types";
import { PROCESSING_STATES } from "../_shared/states";

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

export async function handleTextMessage(
  supabase: SupabaseClient,
  message: any
): Promise<WebhookResponse> {
  try {
    console.log('📝 Processing text message:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      text_length: message.text?.length || 0
    });

    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      message_type: "text",
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title || null,
      message_text: message.text || message.caption || "",
      telegram_data: { message },
      processing_state: "completed",
      processing_completed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("❌ Failed to store text message:", insertError);
      throw insertError;
    }

    return {
      message: "Successfully processed text message",
    };
  } catch (error) {
    console.error("❌ Error in handleTextMessage:", error);
    throw error;
  }
}

export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage
): Promise<WebhookResponse> {
  try {
    const chatInfo = extractChatInfo(message);
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      throw new Error("No media found in message");
    }

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
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null,
      processing_state: message.caption ? PROCESSING_STATES.PENDING : PROCESSING_STATES.INITIALIZED,
      processing_correlation_id: correlationId
    };

    // Insert or update message
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("file_unique_id", mediaInfo.file_unique_id)
      .eq("telegram_message_id", message.message_id)
      .maybeSingle();

    let messageId;
    if (existingMessage) {
      const { error: updateError } = await supabase
        .from("messages")
        .update(messageData)
        .eq("id", existingMessage.id);
      if (updateError) throw updateError;
      messageId = existingMessage.id;
    } else {
      const { data: newMessage, error: insertError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();
      if (insertError) throw insertError;
      messageId = newMessage.id;
    }

    // Download and process media
    const publicUrl = await downloadMedia(supabase, mediaInfo, messageId);

    // If this is part of a media group and has a caption, sync the content
    if (message.media_group_id && message.caption) {
      await syncMediaGroupContent(supabase, messageId, message.media_group_id);
    }

    return { 
      success: true, 
      message: "Media message processed",
      public_url: publicUrl
    };
  } catch (error) {
    console.error("❌ Error handling media message:", error);
    return { success: false, error: error.message };
  }
}

export async function handleEditedMessage(
  supabase: SupabaseClient,
  message: any
): Promise<WebhookResponse> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Get media content if present
    const media = message.photo?.[message.photo.length - 1] || 
                 message.video || 
                 message.document;

    console.log("🔄 Processing edited message:", {
      correlation_id: correlationId,
      message_id: message.message_id,
      has_media: !!media,
      edit_date: message.edit_date,
      is_channel_post: !!message.sender_chat
    });

    // First check if the message exists in our messages table regardless of media
    const { data: existingMessage, error: findError } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .eq("chat_id", message.chat.id)
      .maybeSingle();

    // If we found a matching message in our messages table, handle the update
    if (existingMessage) {
      // Check if this edit is newer
      const editDate = new Date(message.edit_date * 1000);
      const lastUpdate = existingMessage.edit_date ? new Date(existingMessage.edit_date) : null;

      if (lastUpdate && editDate <= lastUpdate) {
        console.log("⏭️ Skipping older edit", {
          correlation_id: correlationId,
          edit_date: editDate,
          last_update: lastUpdate
        });
        return { message: "Edit skipped - not newer" };
      }

      // Update message with new data
      const newCaption = message.caption || "";
      const updatedTelegramData = {
        ...existingMessage.telegram_data,
        message: {
          ...(existingMessage.telegram_data?.message || {}),
          caption: newCaption,
          edit_date: message.edit_date,
          edited_message: true
        }
      };

      // Always trigger reanalysis for edited channel posts with media groups
      const forceReanalysis = message.sender_chat && message.media_group_id;

      // Update the message
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          caption: newCaption,
          telegram_data: updatedTelegramData,
          is_edited: true,
          edit_date: editDate.toISOString(),
          processing_state: 'pending',
          processing_completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingMessage.id);

      if (updateError) {
        console.error("❌ Failed to update message:", {
          correlation_id: correlationId,
          error: updateError.message
        });
        throw updateError;
      }

      // If part of a media group, update related messages
      if (existingMessage.media_group_id && existingMessage.is_original_caption) {
        console.log("🔄 Syncing media group caption:", {
          correlation_id: correlationId,
          media_group_id: existingMessage.media_group_id,
          is_channel_post: !!message.sender_chat
        });

        const { error: groupUpdateError } = await supabase
          .from("messages")
          .update({
            caption: newCaption,
            processing_state: 'pending',
            processing_completed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("media_group_id", existingMessage.media_group_id)
          .neq("id", existingMessage.id);

        if (groupUpdateError) {
          console.error("❌ Error updating group:", {
            correlation_id: correlationId,
            error: groupUpdateError.message
          });
        }
      }

      // Log the edit
      await supabase
        .from("analysis_audit_log")
        .insert({
          message_id: existingMessage.id,
          media_group_id: existingMessage.media_group_id,
          event_type: 'MESSAGE_EDITED',
          old_state: existingMessage.processing_state,
          new_state: 'pending',
          processing_details: {
            correlation_id: correlationId,
            edit_date: message.edit_date,
            previous_caption: existingMessage.caption,
            new_caption: newCaption,
            is_channel_post: !!message.sender_chat,
            force_reanalysis: forceReanalysis
          }
        });

      // Trigger reanalysis if caption changed or force reanalysis is true
      if (newCaption !== existingMessage.caption || forceReanalysis) {
        console.log("🔄 Starting reanalysis:", {
          correlation_id: correlationId,
          message_id: existingMessage.id,
          force_reanalysis: forceReanalysis
        });

        const { error: reanalysisError } = await supabase.functions.invoke(
          'parse-caption-with-ai',
          {
            body: {
              message_id: existingMessage.id,
              media_group_id: existingMessage.media_group_id,
              caption: newCaption,
              correlation_id: correlationId,
              is_edit: true,
              is_channel_post: !!message.sender_chat
            }
          }
        );

        if (reanalysisError) {
          console.error("❌ Reanalysis error:", {
            correlation_id: correlationId,
            error: reanalysisError.message
          });
        }
      }

      return {
        message: "Edit processed successfully",
        details: {
          message_id: existingMessage.id,
          media_group_id: existingMessage.media_group_id,
          reanalysis_triggered: newCaption !== existingMessage.caption || forceReanalysis,
          is_channel_post: !!message.sender_chat
        }
      };
    }
    
    // If we reach here, this is a new message we haven't seen before
    if (media) {
      // If it has media but we don't have it, treat it as a new message
      console.log("📥 Processing as new media message:", {
        correlation_id: correlationId,
        message_id: message.message_id,
        is_channel_post: !!message.sender_chat
      });
      return await handleMediaMessage(supabase, message, Deno.env.get("TELEGRAM_BOT_TOKEN")!);
    } else {
      // Only store in other_messages if it's truly a non-media message we haven't seen before
      console.log("📝 Storing new non-media message:", {
        correlation_id: correlationId,
        message_id: message.message_id,
        is_channel_post: !!message.sender_chat
      });
      
      const { error: insertError } = await supabase.from("other_messages").insert({
        user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
        message_type: message.sender_chat ? "edited_channel_post" : "edited_message",
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title || null,
        message_text: message.text || message.caption || "",
        telegram_data: { message },
        processing_state: "completed"
      });

      if (insertError) throw insertError;
      return { message: "New non-media message stored" };
    }
  } catch (error) {
    console.error("❌ Error in handleEditedMessage:", {
      error,
      correlation_id: correlationId
    });
    throw error;
  }
}

export async function handleChatMemberUpdate(
  supabase: SupabaseClient,
  update: any
): Promise<WebhookResponse> {
  try {
    console.log("👥 Processing chat member update:", update);
    
    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: "chat_member",
      chat_id: update.chat.id,
      chat_type: update.chat.type,
      chat_title: update.chat.title || null,
      telegram_data: { update },
      processing_state: "completed",
      processing_completed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("❌ Failed to store chat member update:", insertError);
      throw insertError;
    }

    return {
      message: "Successfully processed chat member update",
    };
  } catch (error) {
    console.error("❌ Error in handleChatMemberUpdate:", error);
    throw error;
  }
}

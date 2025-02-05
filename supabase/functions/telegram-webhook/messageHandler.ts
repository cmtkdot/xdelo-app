import { TelegramMedia, MediaUploadResult, ProcessedMedia, WebhookResponse } from "./types.ts";
import { downloadTelegramFile, uploadMedia } from "./mediaUtils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { findExistingMessage, updateExistingMessage, createNewMessage, triggerCaptionParsing } from "./dbOperations.ts";

export async function handleTextMessage(
  supabase: ReturnType<typeof createClient>,
  message: any
): Promise<WebhookResponse> {
  try {
    console.log('📝 Processing text message:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      text_length: message.text?.length || 0
    });

    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      message_type: "text",
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
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
  supabase: ReturnType<typeof createClient>,
  message: any,
  TELEGRAM_BOT_TOKEN: string
): Promise<WebhookResponse> {
  const mediaItems: TelegramMedia[] = [];
  const processedMedia: ProcessedMedia[] = [];
  const correlationId = crypto.randomUUID();

  console.log('🖼️ Starting media message processing:', {
    correlation_id: correlationId,
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    has_caption: !!message.caption
  });

  try {
    // Collect media items
    if (message.photo) {
      console.log("📸 Found photo array, selecting largest size");
      const largestPhoto = message.photo[message.photo.length - 1];
      largestPhoto.mime_type = "image/jpeg";
      mediaItems.push(largestPhoto);
    }
    if (message.video) {
      console.log("🎥 Found video");
      mediaItems.push(message.video);
    }
    if (message.document) {
      console.log("📄 Found document");
      mediaItems.push(message.document);
    }

    console.log(`🔄 Processing ${mediaItems.length} media items`);

    for (const mediaItem of mediaItems) {
      console.log("🔍 Processing media item:", {
        file_unique_id: mediaItem.file_unique_id,
        mime_type: mediaItem.mime_type
      });

      // First check if message exists to avoid foreign key constraint issues
      const existingMessage = await findExistingMessage(supabase, mediaItem.file_unique_id);
      let messageData;
      let uploadResult: MediaUploadResult | null = null;
      let shouldReanalyze = false;

      if (existingMessage) {
        // Only reanalyze if caption changed or previous analysis failed
        shouldReanalyze = message.caption && (
          message.caption !== existingMessage.caption || 
          existingMessage.processing_state === 'error'
        );

        console.log("🔄 Duplicate check:", {
          exists: true,
          caption_changed: message.caption !== existingMessage.caption,
          had_error: existingMessage.processing_state === 'error',
          will_reanalyze: shouldReanalyze
        });
      }

      // Get current group count for new messages
      let currentGroupCount = 1;
      if (message.media_group_id) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true})
          .eq('media_group_id', message.media_group_id);
        
        currentGroupCount = (count || 0) + 1;
      }

      if (!existingMessage) {
        console.log("📥 Downloading new media file");
        const fileResponse = await downloadTelegramFile(mediaItem.file_id, TELEGRAM_BOT_TOKEN);
        const fileBuffer = await fileResponse.arrayBuffer();
        
        uploadResult = await uploadMedia(supabase, fileBuffer, {
          fileUniqueId: mediaItem.file_unique_id,
          mimeType: mediaItem.mime_type,
          fileSize: mediaItem.file_size,
        });
        console.log("✅ New file uploaded successfully");
      }

      messageData = {
        telegram_message_id: message.message_id,
        media_group_id: message.media_group_id,
        caption: message.caption || "",
        file_id: mediaItem.file_id,
        file_unique_id: mediaItem.file_unique_id,
        public_url: uploadResult?.publicUrl || existingMessage?.public_url,
        mime_type: mediaItem.mime_type,
        file_size: mediaItem.file_size,
        width: mediaItem.width,
        height: mediaItem.height,
        duration: mediaItem.duration,
        user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
        processing_state: message.caption ? 'pending' : 'initialized',
        group_message_count: message.media_group_id ? currentGroupCount : null,
        is_original_caption: message.caption ? true : false,
        // Essential Telegram data for syncing
        telegram_data: {
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          message_id: message.message_id,
          from_id: message.from?.id,
          date: message.date,
          edit_date: message.edit_date,
          forward_from_chat: message.forward_from_chat,
          forward_from_message_id: message.forward_from_message_id,
          media_group_id: message.media_group_id
        }
      };

      let newMessage;
      if (existingMessage) {
        console.log("🔄 Updating existing message:", existingMessage.id);
        newMessage = await updateExistingMessage(supabase, existingMessage.id, messageData);
      } else {
        console.log("➕ Creating new message");
        newMessage = await createNewMessage(supabase, messageData);
      }

      if (!newMessage || !newMessage.id) {
        throw new Error('Failed to get valid message ID after create/update operation');
      }

      // Trigger AI analysis only for messages with captions that need analysis
      if (message.caption && (!existingMessage || shouldReanalyze)) {
        try {
          console.log("🤖 Triggering AI analysis for message:", newMessage.id);
          await triggerCaptionParsing(supabase, newMessage.id, message.media_group_id, message.caption);
          console.log("✅ AI analysis triggered successfully");
        } catch (error) {
          console.error("❌ Failed to trigger AI analysis:", error);
          // Don't throw here, we still want to process the message
        }
      }

      processedMedia.push({
        file_unique_id: mediaItem.file_unique_id,
        public_url: messageData.public_url,
      });
    }

    return {
      message: "Successfully processed media message",
      processed_media: processedMedia,
    };
  } catch (error) {
    console.error("❌ Error in handleMediaMessage:", error, {
      correlation_id: correlationId,
      message_id: message.message_id
    });
    throw error;
  }
}

export async function handleChatMemberUpdate(
  supabase: ReturnType<typeof createClient>,
  update: any
): Promise<WebhookResponse> {
  try {
    console.log("👥 Processing chat member update:", update);
    
    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: "chat_member",
      chat_id: update.chat.id,
      chat_type: update.chat.type,
      chat_title: update.chat.title,
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

export async function handleMessageEdit(
  supabase: ReturnType<typeof createClient>,
  message: any
): Promise<WebhookResponse> {
  try {
    console.log("✏️ Processing message edit:", {
      message_id: message.message_id,
      chat_id: message.chat.id,
      edit_date: message.edit_date
    });

    // Find all messages with this telegram_message_id and chat_id
    const { data: existingMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .eq("telegram_data->chat_id", message.chat.id);

    if (!existingMessages?.length) {
      console.log("⚠️ No matching messages found for edit");
      return { message: "No messages found to edit" };
    }

    for (const existingMessage of existingMessages) {
      // Update caption and trigger reanalysis if needed
      if (message.caption !== existingMessage.caption) {
        await updateExistingMessage(supabase, existingMessage.id, {
          caption: message.caption || "",
          processing_state: message.caption ? 'pending' : 'initialized',
          telegram_data: {
            ...existingMessage.telegram_data,
            edit_date: message.edit_date
          }
        });

        if (message.caption) {
          await triggerCaptionParsing(supabase, existingMessage.id, existingMessage.media_group_id, message.caption);
        }
      }
    }

    return {
      message: "Successfully processed message edit",
    };
  } catch (error) {
    console.error("❌ Error in handleMessageEdit:", error);
    throw error;
  }
}

export async function handleMessageDelete(
  supabase: ReturnType<typeof createClient>,
  message: any
): Promise<WebhookResponse> {
  try {
    console.log("🗑️ Processing message delete:", {
      message_id: message.message_id,
      chat_id: message.chat.id
    });

    // Find all messages with this telegram_message_id and chat_id
    const { data: existingMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .eq("telegram_data->chat_id", message.chat.id);

    if (!existingMessages?.length) {
      console.log("⚠️ No matching messages found for deletion");
      return { message: "No messages found to delete" };
    }

    // Mark messages as deleted instead of actually deleting them
    for (const existingMessage of existingMessages) {
      await updateExistingMessage(supabase, existingMessage.id, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        telegram_data: {
          ...existingMessage.telegram_data,
          deleted_at: new Date().toISOString()
        }
      });
    }

    return {
      message: "Successfully processed message deletion",
    };
  } catch (error) {
    console.error("❌ Error in handleMessageDelete:", error);
    throw error;
  }
}
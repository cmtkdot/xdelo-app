import { TelegramMedia, MediaUploadResult, ProcessedMedia, WebhookResponse } from "./types.ts";
import { downloadTelegramFile, uploadMedia } from "./mediaUtils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export async function handleTextMessage(
  supabase: ReturnType<typeof createClient>,
  message: any
): Promise<WebhookResponse> {
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
}

export async function handleMediaMessage(
  supabase: ReturnType<typeof createClient>,
  message: any,
  TELEGRAM_BOT_TOKEN: string
): Promise<WebhookResponse> {
  const mediaItems: TelegramMedia[] = [];
  console.log('🖼️ Starting media message processing:', {
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    has_caption: !!message.caption
  });

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
  const processedMedia: ProcessedMedia[] = [];

  for (const mediaItem of mediaItems) {
    console.log("🔍 Processing media item:", {
      file_unique_id: mediaItem.file_unique_id,
      mime_type: mediaItem.mime_type
    });

    // Check for existing message with same file_unique_id
    const { data: existingMessage, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", mediaItem.file_unique_id)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Error checking for existing message:", fetchError);
      throw fetchError;
    }

    let messageData;
    let uploadResult: MediaUploadResult | null = null;

    if (!existingMessage) {
      // Only download and upload if message doesn't exist
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

    // Prepare message data
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
      telegram_data: { message },
      processing_state: message.caption ? 'processing' : 'initialized',
      group_first_message_time: message.media_group_id ? new Date().toISOString() : null,
      group_last_message_time: message.media_group_id ? new Date().toISOString() : null,
      group_message_count: message.media_group_id ? 1 : null
    };

    let newMessage;
    if (existingMessage) {
      // Update existing message
      console.log("🔄 Updating existing message:", existingMessage.id);
      const { data: updatedMessage, error: updateError } = await supabase
        .from("messages")
        .update({
          ...messageData,
          // Preserve existing analyzed content if present
          analyzed_content: existingMessage.analyzed_content || null,
          // Update processing state only if new caption
          processing_state: message.caption && !existingMessage.analyzed_content ? 'processing' : existingMessage.processing_state
        })
        .eq("id", existingMessage.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Failed to update message:", updateError);
        throw updateError;
      }
      newMessage = updatedMessage;
    } else {
      // Insert new message
      console.log("➕ Creating new message");
      const { data: insertedMessage, error: insertError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ Failed to store message:", insertError);
        throw insertError;
      }
      newMessage = insertedMessage;
    }

    // If message has caption and needs analysis, trigger AI analysis
    if (message.caption && (!existingMessage?.analyzed_content || message.caption !== existingMessage.caption)) {
      try {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            message_id: newMessage.id,
            media_group_id: message.media_group_id,
            caption: message.caption
          }
        });
        console.log("✅ AI analysis triggered for message:", newMessage.id);
      } catch (error) {
        console.error("❌ Failed to trigger AI analysis:", error);
        // Don't throw here, we want to continue processing other media items
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
}

export async function handleChatMemberUpdate(
  supabase: ReturnType<typeof createClient>,
  update: any
): Promise<WebhookResponse> {
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
}
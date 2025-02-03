import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { TelegramUpdate, TelegramMessage, TelegramMedia } from "./types.ts";
import { uploadMedia, type MediaUploadResult } from "./mediaUtils.ts";

const BOT_USER_ID = "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7";

export async function handleChatMemberUpdate(
  supabase: ReturnType<typeof createClient>,
  update: TelegramUpdate
) {
  if (!update.my_chat_member) return null;

  const chatMember = update.my_chat_member;
  const { error: insertError } = await supabase.from("other_messages").insert({
    user_id: BOT_USER_ID,
    message_type: "bot_status",
    chat_id: chatMember.chat.id,
    chat_type: chatMember.chat.type,
    chat_title: chatMember.chat.title,
    message_text: `Bot status changed from ${chatMember.old_chat_member.status} to ${chatMember.new_chat_member.status}`,
    telegram_data: update,
    processing_state: "completed",
    processing_completed_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("❌ Failed to store bot status update:", insertError);
    throw insertError;
  }

  return {
    message: "Successfully processed chat member update",
    chat_id: chatMember.chat.id,
    status: chatMember.new_chat_member.status,
  };
}

export async function handleTextMessage(
  supabase: ReturnType<typeof createClient>,
  message: TelegramMessage
) {
  const { error: insertError } = await supabase.from("other_messages").insert({
    user_id: BOT_USER_ID,
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
    chat_id: message.chat.id,
    message_id: message.message_id,
  };
}

export async function handleMediaMessage(
  supabase: ReturnType<typeof createClient>,
  message: TelegramMessage,
  TELEGRAM_BOT_TOKEN: string
) {
  const mediaItems: TelegramMedia[] = [];

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

  console.log(`🖼️ Processing ${mediaItems.length} media items`);

  const processedMedia = [];
  for (const mediaItem of mediaItems) {
    console.log("🔍 Processing media item:", mediaItem.file_unique_id);

    const { data: existingMessage } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", mediaItem.file_unique_id)
      .single();

    let uploadResult: MediaUploadResult;
    if (existingMessage?.public_url) {
      console.log(
        "✅ Found existing file, reusing public URL:",
        existingMessage.public_url
      );
      uploadResult = {
        publicUrl: existingMessage.public_url,
        fileName: `${mediaItem.file_unique_id}.${
          mediaItem.mime_type?.split("/")[1]
        }`,
        mimeType: mediaItem.mime_type || "application/octet-stream",
      };

      const { error: updateError } = await supabase
        .from("messages")
        .update({
          telegram_data: { message },
          caption: message.caption || "",
          media_group_id: message.media_group_id,
          telegram_message_id: message.message_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMessage.id);

      if (updateError) {
        console.error("❌ Failed to update existing message:", updateError);
        throw updateError;
      }
      console.log("✅ Updated existing message with new telegram data");
    } else {
      const fileInfoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${mediaItem.file_id}`
      );
      const fileInfo = await fileInfoResponse.json();
      console.log("📄 File info from Telegram:", JSON.stringify(fileInfo, null, 2));

      if (!fileInfo.ok) {
        throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
      }

      console.log("⬇️ Downloading file from Telegram");
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
      const fileResponse = await fetch(fileUrl);
      const fileBuffer = await fileResponse.arrayBuffer();
      console.log("✅ File downloaded successfully");

      uploadResult = await uploadMedia(supabase, fileBuffer, {
        fileUniqueId: mediaItem.file_unique_id,
        mimeType: mediaItem.mime_type,
        fileSize: mediaItem.file_size,
        width: mediaItem.width,
        height: mediaItem.height,
        duration: mediaItem.duration,
      });
      console.log("✅ File uploaded successfully");

      console.log("💾 Storing new message data in database");
      const { error: messageError } = await supabase.from("messages").insert({
        telegram_message_id: message.message_id,
        media_group_id: message.media_group_id,
        caption: message.caption || "",
        file_id: mediaItem.file_id,
        file_unique_id: mediaItem.file_unique_id,
        public_url: uploadResult.publicUrl,
        mime_type: mediaItem.mime_type,
        file_size: mediaItem.file_size,
        width: mediaItem.width,
        height: mediaItem.height,
        duration: mediaItem.duration,
        user_id: BOT_USER_ID,
        telegram_data: { message },
      });

      if (messageError) {
        console.error("❌ Failed to store message:", messageError);
        throw messageError;
      }
      console.log("✅ Message stored successfully");
    }

    // If message has caption and is part of a media group, trigger caption sync
    if (message.caption && message.media_group_id) {
      try {
        console.log("🔄 Triggering caption sync for media group");
        const { data: messageData } = await supabase
          .from("messages")
          .select("id")
          .eq("telegram_message_id", message.message_id)
          .single();

        if (messageData) {
          const response = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-media-group-caption`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message_id: messageData.id,
                media_group_id: message.media_group_id,
                caption: message.caption,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Caption sync failed: ${await response.text()}`);
          }
          console.log("✅ Caption sync triggered successfully");
        }
      } catch (error) {
        console.error("❌ Error triggering caption sync:", error);
        // Continue processing even if caption sync fails
      }
    }

    processedMedia.push({
      file_unique_id: mediaItem.file_unique_id,
      public_url: uploadResult.publicUrl,
    });
  }

  return {
    message: "Successfully processed media message",
    processed_media: processedMedia,
  };
}

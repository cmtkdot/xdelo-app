import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { TelegramMedia, MediaUploadResult, ProcessedMedia } from "./types.ts";
import { processMediaFiles } from "./mediaUtils.ts";
import { 
  findExistingMessage, 
  updateExistingMessage, 
  createNewMessage, 
  syncMediaGroupCaption, 
  deleteMediaGroupMessages 
} from "./dbOperations.ts";

export async function handleTextMessage(
  supabase: SupabaseClient,
  message: any
): Promise<any> {
  try {
    const existingMessage = await findExistingMessage(supabase, message.message_id.toString());
    if (existingMessage) {
      console.log("📝 Updating existing text message");
      return await updateExistingMessage(supabase, existingMessage.id, {
        message_text: message.text,
        updated_at: new Date().toISOString()
      });
    }

    console.log("📝 Creating new text message");
    return await createNewMessage(supabase, {
      message_id: message.message_id.toString(),
      chat_id: message.chat.id.toString(),
      message_text: message.text,
      message_type: 'text'
    });
  } catch (error) {
    console.error("❌ Error handling text message:", error);
    throw error;
  }
}

export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: any,
  mediaType: string
): Promise<any> {
  try {
    const mediaGroupId = message.media_group_id;
    const caption = message.caption || '';
    
    // Process media files
    const mediaResult = await processMediaFiles(message, mediaType);
    if (!mediaResult) {
      throw new Error("Failed to process media files");
    }

    const messageData = {
      message_id: message.message_id.toString(),
      chat_id: message.chat.id.toString(),
      message_type: mediaType,
      media_group_id: mediaGroupId,
      message_caption: caption,
      file_id: mediaResult.fileId,
      file_unique_id: mediaResult.fileUniqueId,
      file_size: mediaResult.fileSize,
      mime_type: mediaResult.mimeType,
      width: mediaResult.width,
      height: mediaResult.height,
      duration: mediaResult.duration
    };

    const existingMessage = await findExistingMessage(supabase, messageData.file_unique_id);
    if (existingMessage) {
      console.log("📝 Updating existing media message");
      return await updateExistingMessage(supabase, existingMessage.id, messageData);
    }

    console.log("📝 Creating new media message");
    const newMessage = await createNewMessage(supabase, messageData);

    // If this is a media group message with caption, sync it to the group
    if (mediaGroupId && caption) {
      await syncMediaGroupCaption(supabase, mediaGroupId, caption, null);
    }

    return newMessage;
  } catch (error) {
    console.error("❌ Error handling media message:", error);
    throw error;
  }
}

export async function handleChatMemberUpdate(
  supabase: SupabaseClient,
  update: any
): Promise<any> {
  try {
    const { chat_member } = update;
    console.log("👥 Processing chat member update:", {
      chat_id: chat_member.chat.id,
      user_id: chat_member.from.id,
      new_status: chat_member.new_chat_member?.status
    });
    
    return {
      message: "Successfully processed chat member update",
      update_type: "chat_member"
    };
  } catch (error) {
    console.error("❌ Error in handleChatMemberUpdate:", error);
    throw error;
  }
}

export async function handleMessageEdit(
  supabase: SupabaseClient,
  message: any
): Promise<any> {
  try {
    console.log("✏️ Processing message edit:", {
      message_id: message.message_id,
      chat_id: message.chat.id
    });

    return {
      message: "Successfully processed message edit",
      edit_type: "message"
    };
  } catch (error) {
    console.error("❌ Error in handleMessageEdit:", error);
    throw error;
  }
}

export async function handleMessageDelete(
  supabase: SupabaseClient,
  message: any
): Promise<any> {
  try {
    console.log("🗑️ Processing message delete:", {
      message_id: message.message_id,
      chat_id: message.chat.id
    });

    return {
      message: "Successfully processed message delete",
      delete_type: "message"
    };
  } catch (error) {
    console.error("❌ Error in handleMessageDelete:", error);
    throw error;
  }
}
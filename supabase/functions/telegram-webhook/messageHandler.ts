import { SupabaseClient, WebhookResponse, MessageData } from "./types.ts";
import { downloadTelegramFile, uploadMedia } from "./mediaUtils.ts";
import { findExistingMessage, createNewMessage, updateExistingMessage, triggerCaptionParsing } from "./dbOperations.ts";

export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: any,
  botToken: string
): Promise<WebhookResponse> {
  const correlationId = crypto.randomUUID();
  console.log("📸 Processing media message:", {
    correlation_id: correlationId,
    message_id: message.message_id,
    media_group_id: message.media_group_id
  });

  try {
    // Get media content from message
    const media = message.photo?.[message.photo.length - 1] || 
                 message.video || 
                 message.document;

    if (!media) {
      throw new Error("No media found in message");
    }

    // Check for existing message
    const existingMessage = await findExistingMessage(supabase, media.file_unique_id);
    if (existingMessage) {
      console.log("🔄 Message already exists:", {
        correlation_id: correlationId,
        message_id: existingMessage.id
      });
      return { message: "Message already processed" };
    }

    // Initialize group count and position
    let currentGroupCount = 1;
    let groupFirstMessageTime = new Date().toISOString();
    let groupLastMessageTime = new Date().toISOString();

    // If part of a media group, get current count and timestamps
    if (message.media_group_id) {
      const { data: groupMessages, error: countError } = await supabase
        .from("messages")
        .select("created_at")
        .eq("media_group_id", message.media_group_id);

      if (countError) {
        console.error("❌ Error getting group count:", {
          correlation_id: correlationId,
          error: countError.message
        });
        throw countError;
      }

      if (groupMessages && groupMessages.length > 0) {
        currentGroupCount = groupMessages.length + 1;
        const timestamps = groupMessages.map(msg => new Date(msg.created_at));
        groupFirstMessageTime = new Date(Math.min(...timestamps)).toISOString();
        groupLastMessageTime = new Date().toISOString();
      }
    }

    // Download and upload media
    const mediaResponse = await downloadTelegramFile(media.file_id, botToken);
    const buffer = await mediaResponse.arrayBuffer();
    
    const uploadResult = await uploadMedia(supabase, buffer, {
      fileUniqueId: media.file_unique_id,
      mimeType: media.mime_type,
      fileSize: media.file_size
    });

    // Prepare message data
    const messageData: MessageData = {
      telegram_message_id: message.message_id,
      media_group_id: message.media_group_id || null,
      caption: message.caption || "",
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: uploadResult.publicUrl,
      mime_type: uploadResult.mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: media.duration,
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_data: message,
      processing_state: "initialized",
      group_message_count: message.media_group_id ? currentGroupCount : 1,
      group_first_message_time: message.media_group_id ? groupFirstMessageTime : null,
      group_last_message_time: message.media_group_id ? groupLastMessageTime : null,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title
    };

    // Create new message in database
    const newMessage = await createNewMessage(supabase, messageData);

    // If message has caption, trigger parsing
    if (message.caption) {
      await triggerCaptionParsing(
        supabase,
        newMessage.id,
        message.media_group_id,
        message.caption
      );
    }

    return {
      message: "Media processed successfully",
      processed_media: [{
        file_unique_id: media.file_unique_id,
        public_url: uploadResult.publicUrl
      }]
    };

  } catch (error) {
    console.error("❌ Error in handleMediaMessage:", {
      error,
      correlation_id: correlationId,
      message_id: message.message_id
    });
    throw error;
  }
}

export async function handleTextMessage(
  supabase: ReturnType<typeof createClient>,
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

export async function handleEditedMessage(
  supabase: SupabaseClient,
  message: any
): Promise<WebhookResponse> {
  const correlationId = crypto.randomUUID();
  
  try {
    console.log("🔄 Starting edit processing:", {
      correlation_id: correlationId,
      message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      edit_date: message.edit_date,
      has_media: !!(message.photo || message.video || message.document)
    });

    // Find the existing message in our database
    const { data: existingMessage, error: findError } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .maybeSingle();

    if (findError) {
      console.error("❌ Database error finding message:", {
        correlation_id: correlationId,
        error: findError.message
      });
      throw findError;
    }

    if (!existingMessage) {
      console.log("ℹ️ Message not found in messages table, might be a non-media message");
      // Store in other_messages table instead
      const { error: insertError } = await supabase.from("other_messages").insert({
        user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
        message_type: "edited_message",
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_text: message.text || message.caption || "",
        telegram_data: { message },
        processing_state: "completed"
      });

      if (insertError) {
        throw insertError;
      }

      return {
        message: "Edit stored in other_messages",
      };
    }

    // Extract the new caption and prepare update
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

    // Update the source message
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        caption: newCaption,
        telegram_data: updatedTelegramData,
        is_edited: true,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
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

    // If this is part of a media group and has the original caption
    if (existingMessage.media_group_id && existingMessage.is_original_caption) {
      console.log("🔄 Updating media group:", {
        correlation_id: correlationId,
        media_group_id: existingMessage.media_group_id
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
        console.error("❌ Error updating media group:", {
          correlation_id: correlationId,
          error: groupUpdateError.message
        });
      }
    }

    // Log the edit event
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
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          previous_caption: existingMessage.caption,
          new_caption: newCaption
        }
      });

    // Trigger reanalysis if needed
    if (newCaption !== existingMessage.caption) {
      console.log("🔄 Triggering reanalysis:", {
        correlation_id: correlationId,
        message_id: existingMessage.id
      });

      const { error: reanalysisError } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: {
            message_id: existingMessage.id,
            media_group_id: existingMessage.media_group_id,
            caption: newCaption,
            correlation_id: correlationId,
            is_edit: true
          }
        }
      );

      if (reanalysisError) {
        console.error("❌ Error triggering reanalysis:", {
          correlation_id: correlationId,
          error: reanalysisError.message
        });
      }
    }

    return {
      message: "Successfully processed edit",
      details: {
        message_id: existingMessage.id,
        media_group_id: existingMessage.media_group_id,
        reanalysis_triggered: newCaption !== existingMessage.caption
      }
    };
  } catch (error) {
    console.error("❌ Error in handleEditedMessage:", error);
    throw error;
  }
}

import { SupabaseClient, WebhookResponse, MessageData } from "./types.ts";
import { downloadTelegramFile, uploadMedia } from "./mediaUtils.ts";
import { findExistingMessage, createNewMessage, updateExistingMessage, triggerCaptionParsing } from "./dbOperations.ts";

async function getGroupMetadata(supabase: SupabaseClient, mediaGroupId: string | null) {
  if (!mediaGroupId) {
    return {
      currentGroupCount: 1,
      groupFirstMessageTime: new Date().toISOString(),
      groupLastMessageTime: new Date().toISOString()
    };
  }

  const { data: groupMessages, error: countError } = await supabase
    .from("messages")
    .select("created_at")
    .eq("media_group_id", mediaGroupId)
    .order("created_at", { ascending: true });

  if (countError) {
    console.error("❌ Error getting group count:", countError);
    throw countError;
  }

  if (!groupMessages || groupMessages.length === 0) {
    return {
      currentGroupCount: 1,
      groupFirstMessageTime: new Date().toISOString(),
      groupLastMessageTime: new Date().toISOString()
    };
  }

  return {
    currentGroupCount: groupMessages.length + 1,
    groupFirstMessageTime: new Date(groupMessages[0].created_at).toISOString(),
    groupLastMessageTime: new Date().toISOString()
  };
}

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

    // Get group metadata first
    const { currentGroupCount, groupFirstMessageTime, groupLastMessageTime } = 
      await getGroupMetadata(supabase, message.media_group_id);

    console.log("📊 Group metadata:", {
      correlation_id: correlationId,
      media_group_id: message.media_group_id,
      currentGroupCount,
      groupFirstMessageTime,
      groupLastMessageTime
    });

    // Download and upload media
    const mediaResponse = await downloadTelegramFile(media.file_id, botToken);
    const buffer = await mediaResponse.arrayBuffer();
    
    const uploadResult = await uploadMedia(supabase, buffer, {
      fileUniqueId: media.file_unique_id,
      mimeType: media.mime_type,
      fileSize: media.file_size
    });

    // Prepare message data with group information
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
      group_message_count: currentGroupCount,
      group_first_message_time: groupFirstMessageTime,
      group_last_message_time: groupLastMessageTime,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      // Set is_original_caption for group messages
      is_original_caption: message.media_group_id ? currentGroupCount === 1 : true
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

    // After successful processing, update group counts for all messages in the group
    if (message.media_group_id) {
      const { error: updateGroupError } = await supabase
        .from("messages")
        .update({ 
          group_message_count: currentGroupCount,
          group_last_message_time: groupLastMessageTime 
        })
        .eq("media_group_id", message.media_group_id);

      if (updateGroupError) {
        console.error("❌ Error updating group counts:", {
          correlation_id: correlationId,
          error: updateGroupError.message
        });
      }
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
    // Get media content if present
    const media = message.photo?.[message.photo.length - 1] || 
                 message.video || 
                 message.document;

    console.log("🔄 Processing edited message:", {
      correlation_id: correlationId,
      message_id: message.message_id,
      has_media: !!media,
      edit_date: message.edit_date
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
            new_caption: newCaption
          }
        });

      // Trigger reanalysis if caption changed
      if (newCaption !== existingMessage.caption) {
        console.log("🔄 Starting reanalysis:", {
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
          reanalysis_triggered: newCaption !== existingMessage.caption
        }
      };
    }
    
    // If we reach here, this is a new message we haven't seen before
    if (media) {
      // If it has media but we don't have it, treat it as a new message
      console.log("📥 Processing as new media message:", {
        correlation_id: correlationId,
        message_id: message.message_id
      });
      return await handleMediaMessage(supabase, message, Deno.env.get("TELEGRAM_BOT_TOKEN")!);
    } else {
      // Only store in other_messages if it's truly a non-media message we haven't seen before
      console.log("📝 Storing new non-media message:", {
        correlation_id: correlationId,
        message_id: message.message_id
      });
      
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

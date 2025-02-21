export async function handleWebhookUpdate(
  supabase: SupabaseClient,
  update: any,
  correlationId: string
): Promise<WebhookResponse> {
  try {
    console.log('📥 Processing webhook update:', {
      correlation_id: correlationId,
      update_type: Object.keys(update).join(', ')
    });

    // Handle edited channel posts first
    if (update.edited_channel_post) {
      const message = update.edited_channel_post;
      const mediaInfo = extractMediaInfo(message);

      if (mediaInfo) {
        console.log('🔄 Processing edited channel post with media:', {
          correlation_id: correlationId,
          message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaInfo.file_unique_id
        });

        // Process as media message in messages table
        return await handleMediaMessage(supabase, message, correlationId);
      } else {
        // Non-media edited channel post goes to other_messages
        return await handleOtherMessage(supabase, message, correlationId);
      }
    }

    // Handle regular messages and other updates
    const message = update.message || 
                   update.channel_post || 
                   update.edited_message;

    if (!message) {
      // Handle service messages
      if (update.my_chat_member || update.chat_member) {
        const memberUpdate = update.my_chat_member || update.chat_member;
        return await handleChatMemberUpdate(supabase, memberUpdate, correlationId);
      }

      console.log('⚠️ Unhandled update type:', {
        correlation_id: correlationId,
        update_keys: Object.keys(update)
      });

      return {
        success: false,
        message: "Unhandled update type",
        correlation_id: correlationId,
        details: { update_keys: Object.keys(update) }
      };
    }

    // Check for media in regular messages
    const mediaInfo = extractMediaInfo(message);
    if (mediaInfo) {
      return await handleMediaMessage(supabase, message, correlationId);
    }

    // Handle all other message types
    return await handleOtherMessage(supabase, message, correlationId);

  } catch (error) {
    console.error('❌ Error in webhook handler:', {
      correlation_id: correlationId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: "Error processing webhook",
      error: error.message,
      correlation_id: correlationId
    };
  }
}

async function handleEditedChannelMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  try {
    console.log('🔄 Processing edited channel message:', {
      correlation_id: correlationId,
      message_id: message.message_id,
      chat_id: message.chat.id,
      is_channel_post: true
    });

    // Check for existing message in messages table
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .eq("chat_id", message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      // Update existing message
      const updates = {
        caption: message.caption || "",
        is_edited: true,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
        processing_state: message.caption ? "pending" : existingMessage.processing_state,
        telegram_data: {
          ...existingMessage.telegram_data,
          edited_message: message
        },
        updated_at: new Date().toISOString()
      };

      await supabase
        .from("messages")
        .update(updates)
        .eq("id", existingMessage.id);

      // If part of media group, handle syncing
      if (existingMessage.media_group_id) {
        await syncMediaGroupContent(
          supabase,
          existingMessage.id,
          existingMessage.media_group_id,
          correlationId
        );
      }

      return {
        success: true,
        message: "Updated existing channel message",
        correlation_id: correlationId,
        details: { message_id: existingMessage.id }
      };
    }

    // If it has media but wasn't found, process as new media message
    const mediaInfo = extractMediaInfo(message);
    if (mediaInfo) {
      return await handleMediaMessage(supabase, message, correlationId);
    }

    // Otherwise, store as other_message
    return await handleOtherMessage(supabase, message, correlationId);

  } catch (error) {
    console.error('❌ Error handling edited channel message:', {
      correlation_id: correlationId,
      error: error.message
    });
    throw error;
  }
}

export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  try {
    const chatInfo = extractChatInfo(message);
    const mediaInfo = extractMediaInfo(message);
    
    if (!mediaInfo) {
      throw new Error("No media found in message");
    }

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", mediaInfo.file_unique_id)
      .maybeSingle();

    const messageData: MessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      chat_type: chatInfo.chat_type,
      chat_title: chatInfo.chat_title,
      media_group_id: message.media_group_id,
      caption: message.caption || "",
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      telegram_data: { message },
      processing_state: message.caption ? "pending" : "initialized",
      processing_correlation_id: correlationId
    };

    let messageId: string;

    if (existingMessage) {
      await updateMessage(supabase, existingMessage.id, messageData);
      messageId = existingMessage.id;
    } else {
      messageId = await createMessage(supabase, messageData);
    }

    // Process media
    const publicUrl = await downloadMedia(supabase, mediaInfo, messageId);

    // Handle media group syncing
    if (message.media_group_id) {
      if (message.caption) {
        // If this message has caption, sync to group after analysis
        await syncMediaGroupContent(
          supabase,
          messageId,
          message.media_group_id,
          message.caption,
          correlationId
        );
      } else {
        // If no caption, look for analyzed content in group
        const { data: groupMessage } = await supabase
          .from("messages")
          .select("*")
          .eq("media_group_id", message.media_group_id)
          .eq("is_original_caption", true)
          .maybeSingle();

        if (groupMessage?.analyzed_content) {
          await updateMessage(supabase, messageId, {
            analyzed_content: groupMessage.analyzed_content,
            message_caption_id: groupMessage.id,
            processing_state: "completed",
            processing_completed_at: new Date().toISOString(),
            group_message_count: groupMessage.group_message_count
          });
        }
      }
    } else if (message.caption) {
      // Single message with caption - trigger analysis
      await triggerAnalysis(supabase, messageId, message.caption, correlationId);
    }

    return {
      success: true,
      message: "Media processed successfully",
      correlation_id: correlationId,
      details: {
        message_id: messageId,
        public_url: publicUrl,
        media_group_id: message.media_group_id
      }
    };

  } catch (error) {
    console.error("❌ Error handling media message:", {
      correlation_id: correlationId,
      error: error.message
    });
    throw error;
  }
}
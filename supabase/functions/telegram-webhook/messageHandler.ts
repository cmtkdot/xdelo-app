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
    has_caption: !!message.caption,
    chat_id: message.chat.id,
    chat_type: message.chat.type
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
        // Always reanalyze if any of these conditions are met:
        // 1. Caption changed
        // 2. No analyzed content
        // 3. Previous error state
        // 4. Telegram data or group info changed
        const telegramDataChanged = JSON.stringify(existingMessage.telegram_data) !== JSON.stringify({ message });
        const groupInfoChanged = 
          existingMessage.media_group_id !== message.media_group_id ||
          existingMessage.group_message_count !== currentGroupCount;

        shouldReanalyze = (
          message.caption !== existingMessage.caption || 
          !existingMessage.analyzed_content || 
          existingMessage.processing_state === 'error' ||
          telegramDataChanged ||
          groupInfoChanged
        );

        console.log("🔄 Update check:", {
          exists: true,
          caption_changed: message.caption !== existingMessage.caption,
          needs_analysis: !existingMessage.analyzed_content,
          had_error: existingMessage.processing_state === 'error',
          telegram_data_changed: telegramDataChanged,
          group_info_changed: groupInfoChanged,
          will_reanalyze: shouldReanalyze
        });
      }

      // Get current group count for new messages
      let currentGroupCount = 1;
      if (message.media_group_id) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
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
        telegram_data: { message },
        processing_state: shouldReanalyze ? 'pending' : (existingMessage ? 'completed' : (message.caption ? 'pending' : 'initialized')),
        processing_completed_at: shouldReanalyze ? null : new Date().toISOString(),
        group_first_message_time: message.media_group_id ? new Date().toISOString() : null,
        group_last_message_time: message.media_group_id ? new Date().toISOString() : null,
        group_message_count: message.media_group_id ? currentGroupCount : null,
        is_original_caption: message.caption ? true : false,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        analyzed_content: existingMessage && !shouldReanalyze ? existingMessage.analyzed_content : null
      };

      let newMessage;
      if (existingMessage) {
        console.log("🔄 Updating existing message:", existingMessage.id);
        await updateExistingMessage(supabase, existingMessage.id, messageData);
        newMessage = existingMessage;
      } else {
        console.log("➕ Creating new message");
        newMessage = await createNewMessage(supabase, messageData);
      }

      if ((message.caption && !existingMessage) || shouldReanalyze) {
        try {
          console.log("🤖 Triggering AI analysis for message:", newMessage.id);
          await triggerCaptionParsing(supabase, newMessage.id, message.media_group_id, message.caption);
          console.log("✅ AI analysis triggered successfully");
        } catch (error) {
          console.error("❌ Failed to trigger AI analysis:", error);
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

export async function handleEditedMessage(
  supabase: SupabaseClient,
  message: any,
  botToken: string
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  
  try {
    console.log("🔄 Starting edit processing:", {
      correlation_id: correlationId,
      message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      edit_date: message.edit_date,
      has_caption: !!message.caption,
      has_media: !!(message.photo || message.video || message.document)
    });

    // Find the existing message in our database
    const { data: existingMessage, error: findError } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", message.message_id)
      .single();

    if (findError || !existingMessage) {
      console.error("❌ Could not find original message:", {
        correlation_id: correlationId,
        error: findError?.message || "Message not found"
      });
      throw new Error("Original message not found");
    }

    console.log("✅ Found existing message:", {
      correlation_id: correlationId,
      message_id: existingMessage.id,
      media_group_id: existingMessage.media_group_id,
      previous_caption: existingMessage.caption
    });

    // Extract the new caption and update telegram data
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

    // Prepare base update
    const baseUpdate = {
      caption: newCaption,
      telegram_data: updatedTelegramData,
      updated_at: new Date().toISOString(),
      is_edited: true,
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      processing_state: 'pending' as const // Reset to pending for reprocessing
    };

    // Update the message
    const { error: updateError } = await supabase
      .from("messages")
      .update(baseUpdate)
      .eq("id", existingMessage.id);

    if (updateError) {
      console.error("❌ Failed to update message:", {
        correlation_id: correlationId,
        error: updateError.message
      });
      throw updateError;
    }

    console.log("✅ Updated message with new content:", {
      correlation_id: correlationId,
      message_id: existingMessage.id,
      new_caption: newCaption
    });

    // Handle media group updates if necessary
    if (existingMessage.media_group_id && existingMessage.is_original_caption) {
      console.log("🔄 Updating media group caption:", {
        correlation_id: correlationId,
        media_group_id: existingMessage.media_group_id
      });
      
      const { error: groupUpdateError } = await supabase
        .from("messages")
        .update({
          caption: newCaption,
          updated_at: new Date().toISOString(),
          processing_state: 'pending' // Reset all group messages to pending
        })
        .eq("media_group_id", existingMessage.media_group_id);

      if (groupUpdateError) {
        console.error("❌ Error updating media group captions:", {
          correlation_id: correlationId,
          error: groupUpdateError.message
        });
      }
    }

    // Trigger reanalysis
    console.log("🔄 Triggering reanalysis for edited content:", {
      correlation_id: correlationId,
      message_id: existingMessage.id
    });

    const { error: reanalysisError } = await supabase.functions.invoke("parse-caption-with-ai", {
      body: {
        message_id: existingMessage.id,
        media_group_id: existingMessage.media_group_id,
        caption: newCaption,
        correlation_id: correlationId,
        is_edit: true
      }
    });

    if (reanalysisError) {
      console.error("❌ Error triggering reanalysis:", {
        correlation_id: correlationId,
        error: reanalysisError.message
      });
    }

    // Log edit in audit log
    const { error: auditError } = await supabase
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
          editor_id: message.from?.id
        }
      });

    if (auditError) {
      console.error("❌ Error creating audit log:", {
        correlation_id: correlationId,
        error: auditError.message
      });
    }

    console.log("✅ Edit processing completed successfully:", {
      correlation_id: correlationId,
      message_id: existingMessage.id,
      media_group_id: existingMessage.media_group_id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Edited message processed successfully",
        details: {
          correlation_id: correlationId,
          message_id: message.message_id,
          chat_type: message.chat.type,
          edit_date: message.edit_date,
          media_group_id: existingMessage.media_group_id,
          reanalysis_triggered: !reanalysisError
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("❌ Error handling edited message:", {
      correlation_id: correlationId,
      error: error.message
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
}

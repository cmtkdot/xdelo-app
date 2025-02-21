import { SupabaseClient, ExistingMessage, ProcessingState, MessageData } from "./types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string,
  messageId?: number,
  chatId?: number
): Promise<ExistingMessage | null> {
  const correlationId = crypto.randomUUID();
  try {
    // First try to find by file_unique_id
    const { data: fileData, error: fileError } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .maybeSingle();

    if (fileError) {
      console.error("❌ Error checking by file_unique_id:", {
        correlation_id: correlationId,
        error: fileError
      });
      throw fileError;
    }

    if (fileData) {
      console.log("✅ Found message by file_unique_id:", {
        correlation_id: correlationId,
        message_id: fileData.id
      });
      return fileData;
    }

    // If messageId and chatId provided, try finding by those
    if (messageId && chatId) {
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .eq("telegram_message_id", messageId)
        .eq("chat_id", chatId)
        .maybeSingle();

      if (messageError) {
        console.error("❌ Error checking by telegram_message_id:", {
          correlation_id: correlationId,
          error: messageError
        });
        throw messageError;
      }

      if (messageData) {
        console.log("✅ Found message by telegram_message_id:", {
          correlation_id: correlationId,
          message_id: messageData.id
        });
      }

      return messageData;
    }

    return null;
  } catch (error) {
    console.error("❌ Error in findExistingMessage:", {
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  message_id: string,
  updates: Partial<MessageData>,
  isEdit = false
) {
  const correlationId = crypto.randomUUID();
  try {
    console.log("🔄 Updating message:", {
      correlation_id: correlationId,
      message_id,
      is_edit: isEdit
    });

    // Get current message state first
    const { data: currentMessage, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (fetchError) throw fetchError;

    // If this is an edit, log the changes
    if (isEdit) {
      await supabase.from("message_edits").insert({
        message_id,
        previous_state: currentMessage,
        new_state: updates,
        edit_timestamp: new Date().toISOString()
      });
    }

    // Update the message
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        is_edited: isEdit || currentMessage.is_edited
      })
      .eq("id", message_id);

    if (updateError) throw updateError;

    // If this message is part of a group and the caption changed, update group state
    if (currentMessage.media_group_id && updates.caption !== undefined) {
      console.log("🔄 Updating media group state:", {
        correlation_id: correlationId,
        media_group_id: currentMessage.media_group_id
      });

      const { error: groupError } = await supabase
        .from("messages")
        .update({
          processing_state: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq("media_group_id", currentMessage.media_group_id)
        .neq("id", message_id);

      if (groupError) {
        console.error("❌ Error updating group state:", {
          correlation_id: correlationId,
          error: groupError
        });
      }
    }

    console.log("✅ Message updated successfully:", {
      correlation_id: correlationId,
      message_id
    });
  } catch (error) {
    console.error("❌ Error updating message:", {
      correlation_id: correlationId,
      message_id,
      error
    });
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
  const correlationId = crypto.randomUUID();
  try {
    console.log("➕ Creating new message:", {
      correlation_id: correlationId,
      media_group_id: messageData.media_group_id
    });

    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        ...messageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error("❌ Failed to store message:", {
        correlation_id: correlationId,
        error: messageError
      });
      throw messageError;
    }

    console.log("✅ New message created:", {
      correlation_id: correlationId,
      message_id: newMessage.id
    });

    return newMessage;
  } catch (error) {
    console.error("❌ Error in createNewMessage:", {
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}

export async function triggerCaptionParsing(
  supabase: SupabaseClient,
  message_id: string,
  mediaGroupId: string | undefined,
  caption: string,
  isEdit = false
) {
  const correlationId = crypto.randomUUID();
  try {
    console.log("🔄 Triggering caption parsing:", {
      correlation_id: correlationId,
      message_id,
      is_edit: isEdit
    });
    
    // Update message state to pending
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'pending'
    });

    // Call parse-caption-with-ai edge function
    const { error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id,
        media_group_id: mediaGroupId,
        caption,
        correlation_id,
        is_edit: isEdit
      }
    });

    if (error) throw error;
    console.log("✅ Caption parsing triggered successfully:", {
      correlation_id: correlationId,
      message_id
    });
  } catch (error) {
    console.error("❌ Error triggering caption parsing:", {
      correlation_id: correlationId,
      message_id,
      error
    });
    
    // Update message state to error
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'error',
      error_message: error.message
    });
    
    throw error;
  }
}

export async function findAnalyzedGroupMessage(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<ExistingMessage | null> {
  const correlationId = crypto.randomUUID();
  try {
    console.log("🔍 Finding analyzed group message:", {
      correlation_id: correlationId,
      media_group_id: mediaGroupId
    });

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId)
      .eq("processing_state", "completed")
      .is("analyzed_content", "not.null")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      console.error("❌ Error finding analyzed group message:", {
        correlation_id: correlationId,
        error
      });
      throw error;
    }

    if (data) {
      console.log("✅ Found analyzed group message:", {
        correlation_id: correlationId,
        message_id: data.id
      });
    }

    return data;
  } catch (error) {
    console.error("❌ Error in findAnalyzedGroupMessage:", {
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  analyzedContent: any
) {
  const correlationId = crypto.randomUUID();
  try {
    console.log("🔄 Syncing media group content:", {
      correlation_id: correlationId,
      source_message_id: sourceMessageId,
      media_group_id: mediaGroupId
    });

    const { error } = await supabase.rpc("xdelo_process_media_group_content", {
      p_message_id: sourceMessageId,
      p_media_group_id: mediaGroupId,
      p_analyzed_content: analyzedContent
    });

    if (error) {
      console.error("❌ Error syncing group content:", {
        correlation_id: correlationId,
        error
      });
      throw error;
    }

    console.log("✅ Media group content synced:", {
      correlation_id: correlationId,
      media_group_id: mediaGroupId
    });
  } catch (error) {
    console.error("❌ Error in syncMediaGroupContent:", {
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}
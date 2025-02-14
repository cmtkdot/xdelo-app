
import { SupabaseClient, ExistingMessage, ProcessingState, MessageData } from "./types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<ExistingMessage | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking for existing message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in findExistingMessage:", error);
    throw error;
  }
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  messageId: string,
  updateData: Partial<MessageData>
) {
  try {
    const { error } = await supabase
      .from("messages")
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId);

    if (error) {
      console.error("❌ Failed to update existing message:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in updateExistingMessage:", error);
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
  try {
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
      console.error("❌ Failed to store message:", messageError);
      throw messageError;
    }

    return newMessage;
  } catch (error) {
    console.error("❌ Error in createNewMessage:", error);
    throw error;
  }
}

export async function handleExistingMessage(
  supabase: SupabaseClient,
  existingMessage: ExistingMessage,
  newMessageData: MessageData,
  correlationId: string
) {
  const editDate = new Date();
  const lastUpdate = existingMessage.edit_date ? new Date(existingMessage.edit_date) : null;

  // Always update Telegram data and timestamp
  const updateData = {
    telegram_data: {
      ...existingMessage.telegram_data,
      message: newMessageData.telegram_data.message
    },
    updated_at: editDate.toISOString(),
    edit_date: editDate.toISOString()
  };

  // If caption changed, trigger reanalysis
  if (existingMessage.caption !== newMessageData.caption) {
    Object.assign(updateData, {
      caption: newMessageData.caption,
      processing_state: 'pending' as ProcessingState,
      processing_completed_at: null
    });
  }

  console.log("🔄 Updating existing message:", {
    message_id: existingMessage.id,
    correlation_id: correlationId,
    caption_changed: existingMessage.caption !== newMessageData.caption
  });

  await updateExistingMessage(supabase, existingMessage.id, updateData);

  // Log the update
  await supabase.from("analysis_audit_log").insert({
    message_id: existingMessage.id,
    media_group_id: existingMessage.media_group_id,
    event_type: 'MESSAGE_UPDATED',
    old_state: existingMessage.processing_state,
    new_state: updateData.processing_state || existingMessage.processing_state,
    processing_details: {
      correlation_id: correlationId,
      update_time: editDate.toISOString(),
      caption_changed: existingMessage.caption !== newMessageData.caption
    }
  });

  // If caption changed, trigger reanalysis
  if (existingMessage.caption !== newMessageData.caption) {
    await triggerCaptionParsing(
      supabase,
      existingMessage.id,
      existingMessage.media_group_id,
      newMessageData.caption
    );
  }

  return existingMessage;
}

export async function triggerCaptionParsing(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string | undefined,
  caption: string
) {
  try {
    console.log("🔄 Triggering caption parsing for message:", messageId);
    
    // Update message state to pending
    await updateExistingMessage(supabase, messageId, {
      processing_state: 'pending'
    });

    // Call parse-caption-with-ai edge function
    const { error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        media_group_id: mediaGroupId,
        caption,
        correlation_id: crypto.randomUUID()
      }
    });

    if (error) throw error;
    console.log("✅ Caption parsing triggered successfully");
  } catch (error) {
    console.error("❌ Error triggering caption parsing:", error);
    
    // Update message state to error
    await updateExistingMessage(supabase, messageId, {
      processing_state: 'error',
      error_message: error.message
    });
    
    throw error;
  }
}

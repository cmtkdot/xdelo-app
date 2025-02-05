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
    const { data: updatedMessage, error } = await supabase
      .from("messages")
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to update existing message:", error);
      throw error;
    }

    if (!updatedMessage) {
      throw new Error(`No message found with id ${messageId}`);
    }

    return updatedMessage;
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
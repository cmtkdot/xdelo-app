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
  message_id: string,
  updates: Partial<MessageData>
) {
  try {
    const { error } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", message_id);

    if (error) throw error;
  } catch (error) {
    console.error("Error updating message:", error);
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
  message_id: string,
  mediaGroupId: string | undefined,
  caption: string
) {
  try {
    console.log("🔄 Triggering caption parsing for message:", message_id);
    
    // Update message state to pending
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'pending'
    });

    // Call parse-caption-with-ai edge function
    const { error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: message_id,
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
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'error',
      error_message: error.message
    });
    
    throw error;
  }
}
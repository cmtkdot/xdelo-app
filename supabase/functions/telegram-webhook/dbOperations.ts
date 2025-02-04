import { SupabaseClient, ExistingMessage, ProcessingState, MessageData } from "./types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<ExistingMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("file_unique_id", fileUniqueId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") { // PGRST116 is "not found" error
      console.error("❌ Error checking for existing message:", error);
      throw error;
    }
    return null;
  }

  return data;
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  messageId: string,
  updateData: Partial<MessageData>
) {
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
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
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

export async function syncMediaGroupAnalysis(
  supabase: SupabaseClient,
  mediaGroupId: string,
  analyzedContent: Record<string, any>,
  originalMessageId: string
) {
  try {
    console.log("🔄 Syncing media group analysis:", { mediaGroupId, originalMessageId });
    
    // Update all messages in the group
    const { error } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true,
        message_caption_id: originalMessageId,
        updated_at: new Date().toISOString()
      })
      .eq('media_group_id', mediaGroupId);

    if (error) {
      console.error("❌ Error syncing media group analysis:", error);
      throw error;
    }

    console.log("✅ Successfully synced media group analysis");
  } catch (error) {
    console.error("❌ Error in syncMediaGroupAnalysis:", error);
    throw error;
  }
}
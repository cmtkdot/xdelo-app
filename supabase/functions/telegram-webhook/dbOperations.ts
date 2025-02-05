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
      .single();

    if (error) {
      if (error.code === "PGRST116") { // Not found error
        return null;
      }
      console.error("❌ Error checking for existing message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in findExistingMessage:", error);
    throw error;
  }
}

export async function deleteMediaGroupMessages(
  supabase: SupabaseClient,
  mediaGroupId: string
) {
  try {
    console.log("🗑️ Deleting existing media group messages:", mediaGroupId);
    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true })
      .eq("media_group_id", mediaGroupId);

    if (error) {
      console.error("❌ Error deleting media group messages:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in deleteMediaGroupMessages:", error);
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
  try {
    const { data: newMessage, error } = await supabase
      .from("messages")
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to create message:", error);
      throw error;
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
    const { error } = await supabase.rpc('process_message_caption', {
      p_message_id: messageId,
      p_media_group_id: mediaGroupId,
      p_caption: caption
    });

    if (error) {
      console.error("❌ Failed to trigger caption parsing:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in triggerCaptionParsing:", error);
    throw error;
  }
}

export async function syncMediaGroupAnalysis(
  supabase: SupabaseClient,
  mediaGroupId: string,
  analyzedContent: any,
  originalMessageId: string
) {
  try {
    const { error } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('media_group_id', mediaGroupId)
      .neq('id', originalMessageId);

    if (error) {
      console.error("❌ Error syncing media group analysis:", error);
      throw error;
    }

    console.log("✅ Media group analysis synced successfully");
  } catch (error) {
    console.error("❌ Error in syncMediaGroupAnalysis:", error);
    throw error;
  }
}
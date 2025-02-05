import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { MessageData, ProcessingState } from "./types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<any> {
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
): Promise<void> {
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
): Promise<any> {
  try {
    console.log("📝 Creating new message:", messageData.message_id);
    
    const { data, error } = await supabase
      .from("messages")
      .insert([{
        ...messageData,
        processing_state: ProcessingState.Pending,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating new message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in createNewMessage:", error);
    throw error;
  }
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  messageId: string,
  updates: Partial<MessageData>
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in updateExistingMessage:", error);
    throw error;
  }
}

export async function syncMediaGroupCaption(
  supabase: SupabaseClient,
  mediaGroupId: string,
  caption: string,
  analyzedContent: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from("messages")
      .update({
        message_caption: caption,
        analyzed_content: analyzedContent,
        processing_state: ProcessingState.Completed,
        processing_completed_at: new Date().toISOString()
      })
      .eq("media_group_id", mediaGroupId);

    if (error) {
      console.error("❌ Error syncing media group caption:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in syncMediaGroupCaption:", error);
    throw error;
  }
}
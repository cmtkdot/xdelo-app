import { SupabaseClient, ExistingMessage } from "./types.ts";

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
  updateData: any
) {
  // Cast processing_state to the correct enum type
  if (updateData.processing_state) {
    updateData.processing_state = updateData.processing_state as 'initialized' | 'caption_ready' | 'analyzing' | 'analysis_synced' | 'completed' | 'error';
  }

  const { error } = await supabase
    .from("messages")
    .update(updateData)
    .eq("id", messageId);

  if (error) {
    console.error("❌ Failed to update existing message:", error);
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: any
) {
  // Ensure processing_state is properly typed
  if (messageData.processing_state) {
    messageData.processing_state = messageData.processing_state as 'initialized' | 'caption_ready' | 'analyzing' | 'analysis_synced' | 'completed' | 'error';
  }

  const { data: newMessage, error: messageError } = await supabase
    .from("messages")
    .insert(messageData)
    .select()
    .single();

  if (messageError) {
    console.error("❌ Failed to store message:", messageError);
    throw messageError;
  }

  return newMessage;
}

export async function triggerCaptionParsing(
  messageId: string,
  mediaGroupId: string | undefined,
  caption: string
) {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-caption-with-ai`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message_id: messageId,
          media_group_id: mediaGroupId,
          caption
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Caption parsing failed:", errorText);
      throw new Error(`Caption parsing failed: ${errorText}`);
    }
    console.log("✅ Caption parsing triggered successfully");
  } catch (error) {
    console.error("❌ Error triggering caption parsing:", error);
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
    console.log("🔄 Syncing media group analysis:", { mediaGroupId, originalMessageId });
    
    const { error } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: originalMessageId,
      p_media_group_id: mediaGroupId,
      p_analyzed_content: analyzedContent,
      p_processing_completed_at: new Date().toISOString()
    });

    if (error) {
      console.error("❌ Failed to sync media group analysis:", error);
      throw error;
    }

    console.log("✅ Media group analysis synced successfully");
  } catch (error) {
    console.error("❌ Error in syncMediaGroupAnalysis:", error);
    throw error;
  }
}
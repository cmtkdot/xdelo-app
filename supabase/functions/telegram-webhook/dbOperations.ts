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
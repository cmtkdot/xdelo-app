import { SupabaseClient } from "@supabase/supabase-js";
import { 
  MessageData, 
  OtherMessageData, 
  ProcessingStateType,
  StateLogEntry
} from "./types";

// Retrieve an existing message by telegram_message_id and chat_id
export async function findExistingMessage(
  supabase: SupabaseClient,
  telegram_message_id: number,
  chat_id: number
): Promise<MessageData | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*") // Select all fields
    .eq("telegram_message_id", telegram_message_id)
    .eq("chat_id", chat_id)
    .maybeSingle();

  if (error) {
    console.error("❌ Error checking for existing message:", error);
    throw error;
  }
  return data;
}

// Retrieve an existing channel message by telegram_message_id, chat_id, and the channel flag
export async function findExistingChannelMessage(
  supabase: SupabaseClient,
  telegram_message_id: number,
  chat_id: number
): Promise<MessageData | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("telegram_message_id", telegram_message_id)
    .eq("chat_id", chat_id)
    .eq("is_channel_post", true)
    .maybeSingle();

  if (error) {
    console.error("❌ Error finding channel message:", error);
    throw error;
  }
  return data;
}

// Create a new message record
export async function createMessage(
  supabase: SupabaseClient,
  messageData: MessageData
): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      ...messageData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.error("❌ Error creating message:", error);
    throw error;
  }
  return data.id;
}

// Update an existing message record
export async function updateMessage(
  supabase: SupabaseClient,
  messageId: string,
  updates: Partial<MessageData>
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId);

  if (error) {
    console.error("❌ Error updating message:", error);
    throw error;
  }
}

// Create a new "other message" record
export async function createOtherMessage(
  supabase: SupabaseClient,
  messageData: OtherMessageData
): Promise<string> {
  const { data, error } = await supabase
    .from("other_messages")
    .insert({
      ...messageData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.error("❌ Error creating other message:", error);
    throw error;
  }
  return data.id;
}

// Update an existing "other message" record
export async function updateOtherMessage(
  supabase: SupabaseClient,
  messageId: string,
  updates: Partial<OtherMessageData>
): Promise<void> {
  const { error } = await supabase
    .from("other_messages")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId);

  if (error) {
    console.error("❌ Error updating other message:", error);
    throw error;
  }
}

// Create a state log entry for message state changes
export async function createStateLog(
  supabase: SupabaseClient,
  logEntry: StateLogEntry
): Promise<void> {
  const { error } = await supabase
    .from("message_state_logs")
    .insert({
      ...logEntry,
      changed_at: new Date().toISOString()
    });

  if (error) {
    console.error("❌ Error creating state log:", error);
    throw error;
  }
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string,
  caption: string,
  correlationId: string
): Promise<void> {
  try {
    console.log('🔄 Syncing media group:', {
      correlation_id: correlationId,
      message_id: messageId,
      media_group_id: mediaGroupId
    });

    // Get current group messages
    const { data: groupMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId);

    const groupCount = groupMessages?.length || 0;
    const timestamps = groupMessages?.map(m => new Date(m.created_at).getTime()) || [];
    
    // Mark source message
    await updateMessage(supabase, messageId, {
      is_original_caption: true,
      group_caption_synced: true,
      group_message_count: groupCount,
      group_first_message_time: new Date(Math.min(...timestamps)).toISOString(),
      group_last_message_time: new Date(Math.max(...timestamps)).toISOString(),
      processing_correlation_id: correlationId,
      updated_at: new Date().toISOString()
    });

    // Update other messages in group
    const { error } = await supabase
      .from("messages")
      .update({
        caption,
        message_caption_id: messageId,
        is_original_caption: false,
        group_caption_synced: true,
        group_message_count: groupCount,
        processing_state: 'pending',
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", messageId);

    if (error) throw error;

    // Trigger analysis
    await triggerAnalysis(supabase, messageId, caption, correlationId, mediaGroupId);

  } catch (error) {
    console.error("❌ Error syncing media group:", {
      correlation_id: correlationId,
      error: error.message
    });
    throw error;
  }
}

// Helper to update message handler to call the analysis endpoint correctly
export async function triggerAnalysis(
  supabase: SupabaseClient,
  messageId: string,
  caption: string,
  correlationId: string,
  mediaGroupId?: string
): Promise<void> {
  try {
    // First update state to processing
    await updateMessage(supabase, messageId, {
      processing_state: 'processing',
      processing_started_at: new Date().toISOString(),
      processing_correlation_id: correlationId
    });

    const { error } = await supabase.functions.invoke(
      'parse-caption-with-ai',
      {
        body: {
          message_id: messageId,
          media_group_id: mediaGroupId,
          caption,
          correlation_id: correlationId
        }
      }
    );

    if (error) throw error;

  } catch (error) {
    console.error("❌ Error triggering analysis:", {
      correlation_id: correlationId,
      error: error.message
    });
    
    await updateMessage(supabase, messageId, {
      processing_state: 'error',
      error_message: error.message,
      last_error_at: new Date().toISOString()
    });
    
    throw error;
  }
}
// Update message edits when a message is edited
export async function updateMessageEdits(
  supabase: SupabaseClient,
  messageId: string,
  message: any,
  correlationId: string
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    const { error } = await supabase
      .from("messages")
      .update({
        is_edited: true,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
        telegram_data: {
          original_message: message.telegram_data?.message,
          edited_message: message
        },
        processing_state: message.caption ? "pending" : "completed",
        processing_correlation_id: correlationId,
        updated_at: now
      })
      .eq("id", messageId);

    if (error) throw error;
  } catch (error) {
    console.error("❌ Error updating message edits:", error);
    throw error;
  }
}

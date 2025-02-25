import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  MessageData, 
  OtherMessageData, 
  ProcessingStateType,
  StateLogEntry,
  AnalyzedContent
} from "../types.ts";
import { getLogger } from "./logger.ts";

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

// Retrieve an existing message by file_unique_id
export async function findMessageByFileUniqueId(
  supabase: SupabaseClient,
  file_unique_id: string
): Promise<MessageData | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("file_unique_id", file_unique_id)
    .maybeSingle();

  if (error) {
    console.error("❌ Error finding message by file_unique_id:", error);
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

// Sync analyzed content to all messages in a media group
export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string,
  analyzedContent: AnalyzedContent,
  correlationId: string
): Promise<void> {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Syncing media group content', {
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
      group_message_count: groupCount.toString(),
      group_first_message_time: new Date(Math.min(...timestamps)).toISOString(),
      group_last_message_time: new Date(Math.max(...timestamps)).toISOString(),
      processing_correlation_id: correlationId,
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Update other messages in group
    const { error } = await supabase
      .from("messages")
      .update({
        analyzed_content: analyzedContent,
        message_caption_id: messageId,
        is_original_caption: false,
        group_caption_synced: true,
        group_message_count: groupCount.toString(),
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", messageId);

    if (error) throw error;

    logger.info('Successfully synced media group content', {
      message_id: messageId,
      media_group_id: mediaGroupId,
      group_count: groupCount
    });

  } catch (error) {
    logger.error("Error syncing media group content", {
      error: error.message,
      message_id: messageId,
      media_group_id: mediaGroupId
    });
    throw error;
  }
}

// Handle edited message captions, including channel posts
export async function handleEditedCaption(
  supabase: SupabaseClient,
  messageId: string,
  caption: string,
  correlationId: string,
  analyzedContent: AnalyzedContent,
  mediaGroupId?: string
): Promise<void> {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Processing edited caption', {
      message_id: messageId,
      caption_length: caption.length,
      has_media_group: !!mediaGroupId
    });
    
    // Update the message with the new caption and analyzed content
    await updateMessage(supabase, messageId, {
      caption,
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_edited: true,
      updated_at: new Date().toISOString()
    });
    
    // If part of a media group, sync to other messages
    if (mediaGroupId) {
      await syncMediaGroupContent(supabase, messageId, mediaGroupId, analyzedContent, correlationId);
    }
    
    logger.info('Successfully processed edited caption', {
      message_id: messageId,
      has_media_group: !!mediaGroupId
    });
    
  } catch (error) {
    logger.error('Error handling edited caption', {
      error: error.message,
      message_id: messageId
    });
    
    // Update error state
    await updateMessage(supabase, messageId, {
      processing_state: 'error',
      error_message: error.message,
      last_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    throw error;
  }
}

// Find messages in a media group that need caption syncing
export async function findMediaGroupMessagesForSync(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MessageData[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("media_group_id", mediaGroupId)
    .eq("group_caption_synced", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Error finding media group messages for sync:", error);
    throw error;
  }
  
  return data || [];
}

// Find a message in a media group that has analyzed content
export async function findAnalyzedMessageInGroup(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MessageData | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("media_group_id", mediaGroupId)
    .not("analyzed_content", "is", null)
    .eq("processing_state", "completed")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error finding analyzed message in group:", error);
    throw error;
  }
  
  return data;
}

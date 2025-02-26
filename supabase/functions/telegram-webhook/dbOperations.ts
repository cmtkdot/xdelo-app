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

export async function prepareMediaGroupForAnalysis(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string,
  caption: string,
  correlationId: string
): Promise<void> {
  try {
    console.log('🔄 Preparing media group for analysis:', {
      correlation_id: correlationId,
      message_id: messageId,
      media_group_id: mediaGroupId
    });

    // Get the source message to check if it's edited
    const { data: sourceMessage } = await supabase
      .from("messages")
      .select("is_edited, is_channel_post, is_forwarded")
      .eq("id", messageId)
      .single();
    
    const isEdited = sourceMessage?.is_edited || false;

    // Get current group messages
    const { data: groupMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId);

    const groupCount = groupMessages?.length || 0;
    const timestamps = groupMessages?.map(m => new Date(m.created_at).getTime()) || [];
    
    // Mark source message with metadata only
    await updateMessage(supabase, messageId, {
      is_original_caption: true,
      // Don't set group_caption_synced yet - this will happen after analysis
      group_message_count: groupCount,
      group_first_message_time: new Date(Math.min(...timestamps)).toISOString(),
      group_last_message_time: new Date(Math.max(...timestamps)).toISOString(),
      processing_correlation_id: correlationId,
      updated_at: new Date().toISOString()
    });

    // If this is an edited message, reset analyzed_content for all messages in the group
    if (isEdited) {
      console.log('🔄 Resetting analyzed content for edited media group:', {
        correlation_id: correlationId,
        media_group_id: mediaGroupId
      });
      
      // Reset analyzed content for all messages in the group
      const { error: resetError } = await supabase
        .from("messages")
        .update({
          analyzed_content: null,
          processing_state: "initialized",
          group_caption_synced: false,
          message_caption_id: null,
          updated_at: new Date().toISOString()
        })
        .eq("media_group_id", mediaGroupId)
        .neq("id", messageId);
        
      if (resetError) throw resetError;
    }

    // Update other messages with metadata only - NO CAPTION SYNCING
    const { error } = await supabase
      .from("messages")
      .update({
        // Remove caption syncing here
        // Don't set message_caption_id yet
        // Don't set is_original_caption yet
        // Don't set group_caption_synced yet
        group_message_count: groupCount,
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", messageId);

    if (error) throw error;

    // Trigger analysis - this will eventually lead to analyzed_content
    // which will trigger the database function for proper syncing
    await triggerAnalysis(supabase, messageId, caption, correlationId);

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
  correlationId: string
): Promise<void> {
  try {
    // Get message to check if it's edited, a channel post, or forwarded
    const { data: message } = await supabase
      .from("messages")
      .select("is_edited, is_channel_post, is_forwarded")
      .eq("id", messageId)
      .single();
      
    // First update state to processing
    await updateMessage(supabase, messageId, {
      processing_state: 'processing',
      processing_started_at: new Date().toISOString()
    });

    const { error } = await supabase.functions.invoke(
      'parse-caption-with-ai',
      {
        body: {
          messageId,
          caption,
          correlation_id: correlationId,
          is_edit: message?.is_edited || false,
          is_channel_post: message?.is_channel_post || false,
          is_forwarded: message?.is_forwarded || false
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
  correlationId: string,
  flags?: {
    isChannelPost?: boolean,
    isEditedMessage?: boolean,
    isEditedChannelPost?: boolean,
    isForwarded?: boolean
  }
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    // Get the existing message to preserve important fields
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();
      
    if (!existingMessage) {
      throw new Error(`Message with ID ${messageId} not found`);
    }
    
    // Set flags based on parameters or existing message
    const isChannelPost = flags?.isChannelPost || existingMessage.is_channel_post || false;
    const isForwarded = flags?.isForwarded || existingMessage.is_forwarded || false;
    
    // If caption has changed, reset analyzed content
    const captionChanged = message.caption !== existingMessage.caption;
    const analyzedContent = captionChanged ? null : existingMessage.analyzed_content;
    
    // Create edit history entry
    const editHistory = existingMessage.edit_history || [];
    editHistory.push({
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      previous_caption: existingMessage.caption || '',
      new_caption: message.caption || '',
      is_channel_post: isChannelPost
    });
    
    const { error } = await supabase
      .from("messages")
      .update({
        is_edited: true,
        is_channel_post: isChannelPost,
        is_forwarded: isForwarded,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
        edit_history: editHistory,
        caption: message.caption || '',
        telegram_data: {
          original_message: existingMessage.telegram_data?.message || existingMessage.telegram_data,
          edited_message: message
        },
        // Reset analyzed content if caption changed
        analyzed_content: analyzedContent,
        // Set processing state based on caption
        processing_state: captionChanged && message.caption ? "pending" : 
                         captionChanged ? "initialized" : 
                         existingMessage.processing_state,
        processing_correlation_id: correlationId,
        updated_at: now
      })
      .eq("id", messageId);

    if (error) throw error;
    
    // If this is part of a media group and caption changed, reset the group
    if (captionChanged && existingMessage.media_group_id) {
      console.log('🔄 Resetting media group due to caption change:', {
        correlation_id: correlationId,
        media_group_id: existingMessage.media_group_id
      });
      
      // Reset other messages in the group
      const { error: resetError } = await supabase
        .from("messages")
        .update({
          analyzed_content: null,
          processing_state: "initialized",
          group_caption_synced: false,
          message_caption_id: null,
          updated_at: now
        })
        .eq("media_group_id", existingMessage.media_group_id)
        .neq("id", messageId);
        
      if (resetError) throw resetError;
      
      // If there's a caption, trigger analysis
      if (message.caption) {
        await triggerAnalysis(supabase, messageId, message.caption, correlationId);
      }
    }
  } catch (error) {
    console.error("❌ Error updating message edits:", error);
    throw error;
  }
}

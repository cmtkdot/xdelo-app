
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Message, ProcessingState } from "../_shared/types.ts";
import { Database } from "../_shared/types.ts";

interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title: string;
  media_group_id?: string;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  telegram_data: any;
  forward_info?: any;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  correlation_id: string;
}

export async function createMessage(
  supabase: SupabaseClient<Database>,
  messageData: MessageInput,
  logger: any
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        processing_state: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    // Log the creation event
    await logMessageEvent(supabase, 'message_created', {
      entity_id: data.id,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: messageData,
      metadata: {
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        correlation_id: messageData.correlation_id
      }
    });

    return data;
  } catch (error) {
    logger.error('Error creating message:', error);
    throw error;
  }
}

export async function updateMessage(
  supabase: SupabaseClient<Database>,
  chatId: number,
  messageId: number,
  updateData: Partial<Message>,
  logger: any
): Promise<void> {
  try {
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId)
      .single();

    if (!existingMessage) {
      throw new Error('Message not found');
    }

    // Store current analyzed_content in old_analyzed_content array if it exists
    let old_analyzed_content = existingMessage.old_analyzed_content || [];
    if (existingMessage.analyzed_content) {
      old_analyzed_content = [...old_analyzed_content, existingMessage.analyzed_content];
    }

    const { error } = await supabase
      .from('messages')
      .update({
        ...updateData,
        old_analyzed_content,
        updated_at: new Date().toISOString(),
        edit_count: (existingMessage.edit_count || 0) + 1
      })
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId);

    if (error) throw error;

    // Log the update event
    await logMessageEvent(supabase, 'message_updated', {
      entity_id: existingMessage.id,
      telegram_message_id: messageId,
      chat_id: chatId,
      previous_state: existingMessage,
      new_state: updateData,
      metadata: {
        media_group_id: existingMessage.media_group_id,
        is_edit: true,
        correlation_id: updateData.correlation_id
      }
    });
  } catch (error) {
    logger.error('Error updating message:', error);
    throw error;
  }
}

export async function updateMessageProcessingState(
  supabase: SupabaseClient<Database>,
  messageId: string,
  state: ProcessingState,
  analyzedContent?: any,
  error?: string,
  logger?: any
): Promise<void> {
  try {
    const updateData: any = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };

    if (analyzedContent) {
      updateData.analyzed_content = analyzedContent;
      updateData.processing_completed_at = new Date().toISOString();
    }

    if (error) {
      updateData.error_message = error;
      updateData.last_error_at = new Date().toISOString();
    }

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Log the state change
    await logMessageEvent(supabase, 'processing_state_changed', {
      entity_id: messageId,
      telegram_message_id: existingMessage?.telegram_message_id,
      chat_id: existingMessage?.chat_id,
      previous_state: { processing_state: existingMessage?.processing_state },
      new_state: { processing_state: state, analyzed_content: analyzedContent },
      metadata: {
        error_message: error,
        media_group_id: existingMessage?.media_group_id
      }
    });
  } catch (error) {
    logger?.error('Error updating message processing state:', error);
    throw error;
  }
}

async function logMessageEvent(
  supabase: SupabaseClient<Database>,
  eventType: string,
  data: {
    entity_id: string;
    telegram_message_id?: number;
    chat_id?: number;
    previous_state?: any;
    new_state?: any;
    metadata?: any;
    error_message?: string;
  }
): Promise<void> {
  try {
    await supabase.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: data.entity_id,
      telegram_message_id: data.telegram_message_id,
      chat_id: data.chat_id,
      previous_state: data.previous_state,
      new_state: data.new_state,
      metadata: data.metadata,
      error_message: data.error_message
    });
  } catch (error) {
    console.error('Error logging event:', error);
    // Don't throw here to prevent logging errors from affecting main operations
  }
}

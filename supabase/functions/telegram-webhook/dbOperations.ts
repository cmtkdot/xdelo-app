
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ProcessingState, Message, AnalyzedContent } from "../_shared/types.ts";
import { MessageInput, ForwardInfo } from "./types.ts";

interface BaseMessageRecord {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  correlation_id: string;
  processing_state: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  old_analyzed_content?: AnalyzedContent[];
  error_message?: string;
  created_at: string;
  updated_at: string;
  telegram_data: any;
  edit_history?: any[];
  edit_count?: number;
  is_edited_channel_post?: boolean;
  forward_info?: ForwardInfo;
  edit_date?: string;
  user_id?: string;
  retry_count?: number;
  last_error_at?: string;
}

interface MediaMessage extends BaseMessageRecord {
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  group_message_count?: number;
  group_first_message_time?: string;
  group_last_message_time?: string;
}

interface NonMediaMessage extends BaseMessageRecord {
  message_type: string;
  message_text?: string;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  product_quantity?: number;
  purchase_date?: string;
  notes?: string;
}

interface MessageResponse {
  id: string;
  success: boolean;
  error?: string;
}

interface UpdateProcessingStateParams {
  messageId: string;
  state: ProcessingState;
  analyzedContent?: AnalyzedContent;
  error?: string;
  processingStarted?: boolean;
  processingCompleted?: boolean;
}

export async function createMessage(
  supabase: SupabaseClient,
  messageData: MessageInput,
  logger: any
): Promise<MessageResponse> {
  try {
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID().toString();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        correlation_id: correlationId,
        processing_state: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    await logMessageEvent(supabase, 'message_created', {
      entity_id: data.id,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: messageData,
      metadata: {
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        correlation_id: correlationId
      }
    });

    return { id: data.id, success: true };
  } catch (error) {
    logger.error('Error creating message:', error);
    return { id: '', success: false, error: error.message };
  }
}

export async function createNonMediaMessage(
  supabase: SupabaseClient,
  messageData: Omit<NonMediaMessage, 'id' | 'created_at' | 'updated_at'>,
  logger: any
): Promise<MessageResponse> {
  try {
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID().toString();

    const { data, error } = await supabase
      .from('other_messages')
      .insert({
        ...messageData,
        correlation_id: correlationId,
        processing_state: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    await logMessageEvent(supabase, 'non_media_message_created', {
      entity_id: data.id,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: messageData,
      metadata: {
        message_type: messageData.message_type,
        correlation_id: correlationId
      }
    });

    return { id: data.id, success: true };
  } catch (error) {
    logger.error('Error creating non-media message:', error);
    return { id: '', success: false, error: error.message };
  }
}

export async function updateMessage(
  supabase: SupabaseClient,
  chatId: number,
  messageId: number,
  updateData: Partial<MediaMessage>,
  logger: any
): Promise<MessageResponse> {
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

    await logMessageOperation(
      'edit',
      existingMessage.correlation_id,
      {
        message: `Message ${messageId} edited in chat ${chatId}`,
        telegram_message_id: messageId,
        chat_id: chatId,
        source_message_id: existingMessage.id,
        edit_type: 'caption_edit',
        media_group_id: existingMessage.media_group_id
      }
    );

    return { id: existingMessage.id, success: true };
  } catch (error) {
    logger.error('Error updating message:', error);
    return { id: '', success: false, error: error.message };
  }
}

export async function updateMessageProcessingState(
  supabase: SupabaseClient,
  params: UpdateProcessingStateParams,
  logger: any
): Promise<MessageResponse> {
  try {
    const updateData: any = {
      processing_state: params.state,
      updated_at: new Date().toISOString()
    };

    if (params.analyzedContent) {
      updateData.analyzed_content = params.analyzedContent;
      updateData.processing_completed_at = new Date().toISOString();
    }

    if (params.error) {
      updateData.error_message = params.error;
      updateData.last_error_at = new Date().toISOString();
      updateData.retry_count = supabase.sql`COALESCE(retry_count, 0) + 1`;
    }

    if (params.processingStarted) {
      updateData.processing_started_at = new Date().toISOString();
    }

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', params.messageId);

    if (updateError) throw updateError;

    const correlationId = existingMessage?.correlation_id ? 
      existingMessage.correlation_id.toString() : 
      null;

    await logMessageOperation(
      'processing_state_changed',
      correlationId,
      {
        message: `Processing state updated for message ${params.messageId}`,
        telegram_message_id: existingMessage?.telegram_message_id,
        chat_id: existingMessage?.chat_id,
        source_message_id: params.messageId,
        processing_state: params.state,
        error: params.error
      }
    );

    return { id: params.messageId, success: true };
  } catch (error) {
    logger?.error('Error updating message processing state:', error);
    return { id: params.messageId, success: false, error: error.message };
  }
}

async function logMessageEvent(
  supabase: SupabaseClient,
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
      error_message: data.error_message,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

async function logMessageOperation(
  operationType: string,
  correlationId: string | null,
  data: {
    message: string;
    telegram_message_id?: number;
    chat_id?: number;
    source_message_id?: string;
    [key: string]: any;
  }
): Promise<void> {
  try {
    await supabase.from('unified_audit_logs').insert({
      event_type: operationType,
      entity_id: data.source_message_id,
      telegram_message_id: data.telegram_message_id,
      chat_id: data.chat_id,
      metadata: {
        ...data,
        correlation_id: correlationId
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

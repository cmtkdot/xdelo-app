import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ProcessingState, Message, AnalyzedContent } from "../_shared/types";
import { MessageInput, ForwardInfo } from "./types";

// Types specific to dbOperations
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
  telegram_data: Record<string, unknown>;
  edit_history?: Record<string, unknown>[];
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
  error_message?: string;
  error_code?: string;
}

interface UpdateProcessingStateParams {
  messageId: string;
  state: ProcessingState;
  analyzedContent?: AnalyzedContent;
  error?: string;
  processingStarted?: boolean;
  processingCompleted?: boolean;
}

interface LoggerInterface {
  error: (message: string, error: unknown) => void;
  info?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
}

export async function createMessage(
  supabase: SupabaseClient,
  messageData: MessageInput,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Ensure correlation_id is stored as string
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID().toString();

    // Try to use RPC to handle schema-agnostic insert if available
    try {
      const { data, error } = await supabase.rpc('xdelo_create_message', {
        message_data: messageData,
        p_correlation_id: correlationId
      });

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
    } catch (rpcError) {
      // If RPC is not available, fall back to direct insert but with explicit columns
      // This avoids the "column not found in schema" error by being explicit
      logger.error('RPC failed, using direct insert', rpcError);
      
      // Create an object with only the supported columns
      const safeMessageData = {
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        chat_type: messageData.chat_type,
        chat_title: messageData.chat_title,
        caption: messageData.caption,
        media_group_id: messageData.media_group_id,
        file_id: messageData.file_id,
        file_unique_id: messageData.file_unique_id,
        mime_type: messageData.mime_type,
        file_size: messageData.file_size,
        width: messageData.width,
        height: messageData.height,
        duration: messageData.duration,
        storage_path: messageData.storage_path,
        public_url: messageData.public_url,
        correlation_id: correlationId,
        processing_state: 'pending',
        telegram_data: messageData.telegram_data,
        forward_info: messageData.forward_info,
        is_edited_channel_post: messageData.is_edited_channel_post,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(safeMessageData)
        .select('id')
        .single();

      if (error) throw error;

      await logMessageEvent(supabase, 'message_created', {
        entity_id: data.id,
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        new_state: safeMessageData,
        metadata: {
          media_group_id: messageData.media_group_id,
          is_forward: !!messageData.forward_info,
          correlation_id: correlationId
        }
      });

      return { id: data.id, success: true };
    }
  } catch (error) {
    logger.error('Error creating message:', error);
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'DB_INSERT_ERROR' 
    };
  }
}

export async function createNonMediaMessage(
  supabase: SupabaseClient,
  messageData: Omit<NonMediaMessage, 'id' | 'created_at' | 'updated_at'>,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Ensure correlation_id is stored as string
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
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'NON_MEDIA_INSERT_ERROR'
    };
  }
}

export async function updateMessage(
  supabase: SupabaseClient,
  chatId: number,
  messageId: number,
  updateData: Partial<MediaMessage>,
  logger: LoggerInterface
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

    return { id: existingMessage.id, success: true };
  } catch (error) {
    logger.error('Error updating message:', error);
    return { 
      id: '', 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'MESSAGE_UPDATE_ERROR'
    };
  }
}

export async function updateMessageProcessingState(
  supabase: SupabaseClient,
  params: UpdateProcessingStateParams,
  logger: LoggerInterface
): Promise<MessageResponse> {
  try {
    // Get existing message first to ensure we have current state
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    if (!existingMessage) {
      throw new Error('Message not found');
    }

    const updateData: Record<string, unknown> = {
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
      updateData.retry_count = (existingMessage.retry_count || 0) + 1;
    }

    if (params.processingStarted) {
      updateData.processing_started_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', params.messageId);

    if (updateError) throw updateError;

    // Ensure correlation_id is a string for logging
    const correlationId = existingMessage?.correlation_id ? 
      existingMessage.correlation_id.toString() : 
      null;

    await logMessageEvent(supabase, 'processing_state_changed', {
      entity_id: params.messageId,
      telegram_message_id: existingMessage?.telegram_message_id,
      chat_id: existingMessage?.chat_id,
      previous_state: { 
        processing_state: existingMessage?.processing_state,
        analyzed_content: existingMessage?.analyzed_content 
      },
      new_state: { 
        processing_state: params.state,
        analyzed_content: params.analyzedContent 
      },
      metadata: {
        error_message: params.error,
        media_group_id: existingMessage?.media_group_id,
        retry_count: updateData.retry_count,
        correlation_id: correlationId
      }
    });

    return { id: params.messageId, success: true };
  } catch (error) {
    if (logger?.error) {
      logger.error('Error updating message processing state:', error);
    } else {
      console.error('Error updating message processing state:', error);
    }
    return { 
      id: params.messageId, 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error),
      error_code: error instanceof Error && 'code' in error ? (error as {code?: string}).code : 'PROCESSING_STATE_UPDATE_ERROR'
    };
  }
}

async function logMessageEvent(
  supabase: SupabaseClient,
  eventType: string,
  data: {
    entity_id: string;
    telegram_message_id?: number;
    chat_id?: number;
    previous_state?: Record<string, unknown>;
    new_state?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
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


import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ProcessingState, Message, AnalyzedContent } from "../_shared/types.ts";
import { MessageInput, ForwardInfo } from "./types";

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

/**
 * Create a media message with duplicate detection based on file_unique_id
 */
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
    
    logger.info?.('Creating message with correlation_id', { 
      correlation_id: correlationId,
      file_unique_id: messageData.file_unique_id
    });

    // First check if a message with this file_unique_id already exists
    // This is our primary duplicate detection mechanism
    if (messageData.file_unique_id) {
      const { data: existingFile } = await supabase
        .from('messages')
        .select('id, file_unique_id, storage_path, telegram_message_id, chat_id, public_url')
        .eq('file_unique_id', messageData.file_unique_id)
        .maybeSingle();

      if (existingFile) {
        logger.info?.('Found existing file with same file_unique_id', { 
          existing_id: existingFile.id,
          file_unique_id: messageData.file_unique_id
        });

        // Log duplicate detection
        await logMessageEvent(supabase, 'duplicate_file_detected', {
          entity_id: existingFile.id,
          telegram_message_id: messageData.telegram_message_id,
          chat_id: messageData.chat_id,
          metadata: {
            file_unique_id: messageData.file_unique_id,
            correlation_id: correlationId,
            existing_message_id: existingFile.id,
            new_telegram_message_id: messageData.telegram_message_id,
            new_chat_id: messageData.chat_id
          }
        });

        return { 
          id: existingFile.id, 
          success: true,
          error_message: "File already exists in database" 
        };
      }
    }

    // Prepare message data with consistent format
    // Use the public_url directly from messageData
    // This will now be properly set by the mediaUtils.ts uploadMediaToStorage function
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
      public_url: messageData.public_url, // Use the URL set by the uploader
      correlation_id: correlationId,
      processing_state: 'pending' as ProcessingState,
      telegram_data: messageData.telegram_data,
      forward_info: messageData.forward_info,
      is_edited_channel_post: messageData.is_edited_channel_post,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert message data directly
    const { data, error } = await supabase
      .from('messages')
      .insert(safeMessageData)
      .select('id')
      .single();

    if (error) throw error;

    const messageId = data.id;

    // Log message creation event
    await logMessageEvent(supabase, 'message_created', {
      entity_id: messageId,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: safeMessageData,
      metadata: {
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        correlation_id: correlationId
      }
    });

    return { id: messageId, success: true };
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
    
    logger.info?.('Creating non-media message with correlation_id', { 
      correlation_id: correlationId,
      message_type: messageData.message_type
    });

    const messageDataWithTimestamps = {
      ...messageData,
      correlation_id: correlationId,
      processing_state: 'pending' as ProcessingState,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('other_messages')
      .insert(messageDataWithTimestamps)
      .select('id')
      .single();

    if (error) throw error;

    const messageId = data.id;

    // Log message creation
    await logMessageEvent(supabase, 'non_media_message_created', {
      entity_id: messageId,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: messageDataWithTimestamps,
      metadata: {
        message_type: messageData.message_type,
        correlation_id: correlationId
      }
    });

    return { id: messageId, success: true };
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
    // Remove public_url if it's in the update data
    if ('public_url' in updateData) {
      delete updateData.public_url;
    }
    
    // Log the start of update operation
    logger.info?.('Updating message', {
      chat_id: chatId,
      telegram_message_id: messageId,
      update_keys: Object.keys(updateData)
    });

    // Get existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId)
      .single();

    if (fetchError || !existingMessage) {
      throw new Error(fetchError?.message || 'Message not found');
    }

    // Handle analyzed_content history
    let old_analyzed_content = existingMessage.old_analyzed_content || [];
    if (existingMessage.analyzed_content) {
      old_analyzed_content = [...old_analyzed_content, existingMessage.analyzed_content];
    }

    // Prepare update data
    const updateWithTimestamp = {
      ...updateData,
      old_analyzed_content,
      updated_at: new Date().toISOString(),
      edit_count: (existingMessage.edit_count || 0) + 1
    };

    // Update message
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateWithTimestamp)
      .eq('chat_id', chatId)
      .eq('telegram_message_id', messageId);

    if (updateError) throw updateError;

    // Log update event
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
    // Log state update operation
    logger.info?.('Updating message processing state', {
      message_id: params.messageId,
      new_state: params.state
    });

    // Get existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    if (fetchError || !existingMessage) {
      throw new Error(fetchError?.message || 'Message not found');
    }

    // Prepare update data
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

    // Update message state
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', params.messageId);

    if (updateError) throw updateError;

    // Get correlation_id for logging
    const correlationId = existingMessage?.correlation_id ? 
      existingMessage.correlation_id.toString() : 
      null;

    // Log state change
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

/**
 * Check if a message with this file_unique_id already exists
 */
export async function checkDuplicateFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<Message | null> {
  try {
    if (!fileUniqueId) return null;
    
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();
    
    return data;
  } catch (error) {
    console.error('Error checking for duplicate file:', error);
    return null;
  }
}

/**
 * Log an event to the unified_audit_logs table
 */
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
    // Ensure metadata always has a timestamp
    const metadata = {
      ...(data.metadata || {}),
      event_timestamp: new Date().toISOString()
    };

    await supabase.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: data.entity_id,
      telegram_message_id: data.telegram_message_id,
      chat_id: data.chat_id,
      previous_state: data.previous_state,
      new_state: data.new_state,
      metadata: metadata,
      error_message: data.error_message,
      event_timestamp: new Date().toISOString(),
      correlation_id: metadata.correlation_id
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

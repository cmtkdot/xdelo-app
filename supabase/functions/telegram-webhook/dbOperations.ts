
import { createSupabaseClient } from '../_shared/supabase.ts';
import { TelegramMessage } from './types.ts';
import { FileInfo } from './types.ts';

/**
 * Creates a new message in the database
 */
export async function createMessage(
  message: TelegramMessage,
  fileInfo: FileInfo,
  isEdit: boolean,
  isChannelPost: boolean,
  isForwarded: boolean,
  forwardInfo: any,
  messageUrl: string,
  correlationId: string
): Promise<string> {
  const supabase = createSupabaseClient();
  
  // Extract message data
  const {
    message_id,
    chat,
    date,
    caption,
    media_group_id,
    text
  } = message;
  
  // Extract file info
  const {
    file_id,
    file_unique_id,
    mime_type,
    file_size,
    width,
    height,
    duration,
    storage_path,
    public_url
  } = fileInfo;
  
  // Create message record
  const { data, error } = await supabase
    .from('messages')
    .insert({
      telegram_message_id: message_id.toString(),
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      message_type: isChannelPost ? 'channel_post' : 'message',
      caption,
      telegram_data: message,
      file_id,
      file_unique_id,
      mime_type,
      file_size,
      width,
      height,
      duration,
      media_group_id,
      storage_path,
      public_url,
      is_original_caption: media_group_id ? true : null,
      created_at: new Date(date * 1000).toISOString(),
      message_url: messageUrl,
      is_forward: isForwarded,
      forward_info: forwardInfo,
      processing_state: caption ? 'pending' : 'completed',
      correlation_id: correlationId
    })
    .select('id')
    .single();
    
  if (error) {
    throw new Error(`Failed to create message record: ${error.message}`);
  }
  
  return data.id;
}

/**
 * Updates an existing message in the database
 */
export async function updateMessage(
  messageId: string,
  message: TelegramMessage,
  fileInfo: FileInfo,
  isEdit: boolean,
  isChannelPost: boolean,
  isForwarded: boolean,
  forwardInfo: any,
  messageUrl: string,
  correlationId: string
): Promise<void> {
  const supabase = createSupabaseClient();
  
  // Extract message data
  const {
    message_id,
    chat,
    date,
    caption,
    media_group_id,
    edit_date,
    text
  } = message;
  
  // Get existing message first to prepare edit history
  const { data: existingMessage, error: fetchError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();
    
  if (fetchError) {
    throw new Error(`Failed to fetch existing message: ${fetchError.message}`);
  }
  
  // Prepare edit history
  let editHistory = existingMessage.edit_history || [];
  editHistory.push({
    edit_date: edit_date ? new Date(edit_date * 1000).toISOString() : new Date().toISOString(),
    previous_caption: existingMessage.caption,
    new_caption: caption,
    previous_telegram_data: existingMessage.telegram_data
  });
  
  // Extract file info
  const {
    file_id,
    file_unique_id,
    mime_type,
    file_size,
    width,
    height,
    duration,
    storage_path,
    public_url
  } = fileInfo;
  
  // Update fields that have changed
  const updateData: any = {
    telegram_message_id: message_id.toString(),
    chat_id: chat.id,
    chat_type: chat.type,
    chat_title: chat.title,
    message_type: isChannelPost ? 'channel_post' : 'message',
    caption,
    telegram_data: message,
    message_url: messageUrl,
    is_forward: isForwarded,
    forward_info: forwardInfo,
    edit_history: editHistory,
    edit_date: edit_date ? new Date(edit_date * 1000).toISOString() : new Date().toISOString(),
    edit_count: (existingMessage.edit_count || 0) + 1,
    is_edited: true,
    correlation_id: correlationId,
    updated_at: new Date().toISOString()
  };
  
  // Only update file info if it has changed
  if (file_id !== existingMessage.file_id || storage_path !== existingMessage.storage_path) {
    updateData.file_id = file_id;
    updateData.file_unique_id = file_unique_id;
    updateData.mime_type = mime_type;
    updateData.file_size = file_size;
    updateData.width = width;
    updateData.height = height;
    updateData.duration = duration;
    updateData.storage_path = storage_path;
    updateData.public_url = public_url;
  }
  
  // Reset analysis state if caption has changed
  if (caption !== existingMessage.caption) {
    updateData.analyzed_content = null;
    updateData.processing_state = 'pending';
    updateData.group_caption_synced = false;
    
    // Store previous analyzed content in history if it exists
    if (existingMessage.analyzed_content) {
      updateData.old_analyzed_content = [
        ...(existingMessage.old_analyzed_content || []),
        existingMessage.analyzed_content
      ];
    }
  }
  
  // Update message record
  const { error } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', messageId);
    
  if (error) {
    throw new Error(`Failed to update message record: ${error.message}`);
  }
}

/**
 * Stores an analysis trigger in the database
 */
export async function createAnalysisTrigger(
  messageId: string,
  correlationId: string
): Promise<void> {
  const supabase = createSupabaseClient();
  
  // Create analysis trigger
  const { error } = await supabase
    .from('unified_audit_logs')
    .insert({
      event_type: 'caption_ready_for_processing',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        triggered_at: new Date().toISOString(),
        source: 'telegram-webhook'
      },
      event_timestamp: new Date().toISOString()
    });
    
  if (error) {
    throw new Error(`Failed to create analysis trigger: ${error.message}`);
  }
}

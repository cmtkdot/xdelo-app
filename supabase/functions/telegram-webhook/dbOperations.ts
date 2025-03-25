import { supabaseClient } from '../_shared/supabase.ts';
import { TelegramMessage, MessageInput, MessageResult } from './types.ts';
import { Logger } from './utils/logger.ts';
import { xdelo_withDatabaseRetry } from '../_shared/retryUtils.ts';

/**
 * Check if a message is a duplicate based on telegram_message_id and chat_id
 */
export async function checkDuplicateFile(
  supabase = supabaseClient,
  messageId: number,
  chatId: number
): Promise<boolean> {
  try {
    return await xdelo_withDatabaseRetry(`check_duplicate_${messageId}_${chatId}`, async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('telegram_message_id', messageId)
        .eq('chat_id', chatId)
        .limit(1);

      if (error) {
        console.error('Error checking for duplicate message:', error);
        return false;
      }

      return data && data.length > 0;
    });
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return false;
  }
}

/**
 * Create a new message record with enhanced retry logic
 */
export async function createMessage(
  supabase = supabaseClient,
  message: MessageInput,
  logger?: Logger
): Promise<MessageResult> {
  try {
    logger?.info('Creating message record');
    
    return await xdelo_withDatabaseRetry(`create_message_${message.telegram_message_id}`, async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          telegram_message_id: message.telegram_message_id,
          chat_id: message.chat_id,
          chat_type: message.chat_type,
          chat_title: message.chat_title,
          media_group_id: message.media_group_id,
          file_id: message.file_id,
          file_unique_id: message.file_unique_id,
          caption: message.caption,
          mime_type: message.mime_type,
          mime_type_original: message.mime_type_original,
          width: message.width,
          height: message.height,
          duration: message.duration,
          file_size: message.file_size,
          storage_path: message.storage_path,
          storage_exists: message.storage_exists || false,
          storage_path_standardized: message.storage_path_standardized || false,
          public_url: message.public_url,
          processing_state: message.processing_state || 'initialized',
          telegram_data: message.telegram_data,
          is_forward: message.is_forward,
          forward_info: message.forward_info,
          correlation_id: message.correlation_id,
          message_url: message.message_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          edit_history: message.edit_history || [],
          edit_date: message.edit_date,
          is_edited: !!message.edit_history?.length
        })
        .select('id')
        .single();

      if (error) {
        logger?.error(`Error creating message record: ${error.message}`, { error });
        return { success: false, error_message: error.message };
      }

      logger?.info(`Message record created successfully: ${data.id}`);
      return { success: true, id: data.id };
    });
  } catch (error) {
    logger?.error(`Exception creating message record: ${error.message}`, { error });
    return { success: false, error_message: error.message };
  }
}

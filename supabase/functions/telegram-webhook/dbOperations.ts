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
    
    // Add timestamp to message record to prevent transaction conflicts
    const now = new Date().toISOString();
    
    // Ensure we have a clean-up function in case of errors
    const cleanupOnError = async (error: any) => {
      try {
        // Check if a partial record was created that might be causing transaction issues
        if (error?.message?.includes('transaction') || error?.code === '2D000') {
          logger?.warn('Attempting to clean up potential transaction issues', { 
            message_id: message.telegram_message_id, 
            chat_id: message.chat_id 
          });
          
          // Try to fetch any partial records
          const { data: existingRecords } = await supabase
            .from('messages')
            .select('id')
            .eq('telegram_message_id', message.telegram_message_id)
            .eq('chat_id', message.chat_id)
            .limit(5);
            
          // If we found records, log them but don't try to delete - safer
          if (existingRecords?.length) {
            logger?.info(`Found ${existingRecords.length} existing records for message`, { 
              existing_ids: existingRecords.map(r => r.id),
              message_id: message.telegram_message_id
            });
          }
        }
      } catch (cleanupError) {
        // Just log the cleanup error but don't fail the whole operation
        logger?.error('Error during cleanup', { error: cleanupError });
      }
    };
    
    return await xdelo_withDatabaseRetry(`create_message_${message.telegram_message_id}`, async () => {
      try {
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
            created_at: now,
            updated_at: now,
            edit_history: message.edit_history || [],
            edit_date: message.edit_date,
            is_edited: !!message.edit_history?.length
          })
          .select('id')
          .single();

        if (error) {
          logger?.error(`Error creating message record: ${error.message}`, { 
            error,
            messageId: message.telegram_message_id,
            chatId: message.chat_id
          });
          
          // Run cleanup function if there was an error
          await cleanupOnError(error);
          
          return { success: false, error_message: error.message };
        }

        logger?.info(`Message record created successfully: ${data.id}`);
        return { success: true, id: data.id };
      } catch (insertError) {
        // If there's an exception during the insert, clean up
        await cleanupOnError(insertError);
        throw insertError; // Re-throw for retry mechanism
      }
    }, {
      // Add special handling for transaction errors
      retryCondition: (error) => {
        // Don't retry on certain errors that won't be fixed by retrying
        if (error?.code === '23505') { // Unique violation
          logger?.warn('Not retrying on unique violation', { error: error.message });
          return false;
        }
        // Always retry on transaction errors
        if (error?.message?.includes('transaction') || error?.code === '2D000') {
          logger?.warn('Retrying on transaction error', { error: error.message });
          return true;
        }
        return true; // Default retry for other errors
      }
    });
  } catch (error) {
    logger?.error(`Exception creating message record: ${error.message}`, { error });
    return { success: false, error_message: error.message };
  }
}

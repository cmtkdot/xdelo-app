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
 * Check if file with same file_unique_id exists and return its details
 * This allows us to update existing file analysis or link related messages
 */
export async function findExistingFileByUniqueId(
  supabase = supabaseClient,
  fileUniqueId: string,
  logger?: Logger
): Promise<{ exists: boolean; messageId?: string; analyzedContent?: any; }> {
  try {
    logger?.info(`Checking for existing file with unique ID: ${fileUniqueId}`);
    
    return await xdelo_withDatabaseRetry(`find_file_${fileUniqueId}`, async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .eq('file_unique_id', fileUniqueId)
        .order('created_at', { ascending: false }) // Get the most recent one
        .limit(1);

      if (error) {
        logger?.error(`Error checking for existing file: ${error.message}`, { error });
        return { exists: false };
      }

      if (data && data.length > 0) {
        logger?.info(`Found existing file with same unique ID: ${data[0].id}`);
        return { 
          exists: true, 
          messageId: data[0].id,
          analyzedContent: data[0].analyzed_content
        };
      }

      return { exists: false };
    });
  } catch (error) {
    logger?.error(`Exception finding existing file: ${error.message}`, { error });
    return { exists: false };
  }
}

/**
 * Update a message with analysis from a similar file
 * Used when the same file is shared multiple times
 */
export async function updateWithExistingAnalysis(
  supabase = supabaseClient,
  messageId: string,
  fileInfo: { analyzedContent: any },
  logger?: Logger
): Promise<boolean> {
  try {
    logger?.info(`Updating message ${messageId} with existing analysis`);
    
    // Create a timestamp for the update
    const now = new Date().toISOString();
    
    return await xdelo_withDatabaseRetry(`update_with_analysis_${messageId}`, async () => {
      const { error } = await supabase
        .from('messages')
        .update({
          analyzed_content: fileInfo.analyzedContent,
          processing_state: 'completed',
          processing_completed_at: now,
          is_duplicate_content: true,
          updated_at: now
        })
        .eq('id', messageId);

      if (error) {
        logger?.error(`Error updating message with existing analysis: ${error.message}`, { error });
        return false;
      }

      logger?.info(`Successfully updated message ${messageId} with existing analysis`);
      return true;
    });
  } catch (error) {
    logger?.error(`Exception updating with existing analysis: ${error.message}`, { error });
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
    
    // First check if we already have a file with the same unique ID
    if (message.file_unique_id) {
      const existingFile = await findExistingFileByUniqueId(supabase, message.file_unique_id, logger);
      if (existingFile.exists && existingFile.analyzedContent) {
        logger?.info(`Found existing file analysis for ${message.file_unique_id}`);
        
        // We'll still create the message record, but we'll mark it as a duplicate and
        // copy over the existing analysis
        message.is_duplicate_content = true;
        message.analyzed_content = existingFile.analyzedContent;
        message.processing_state = 'completed'; // Skip processing since we already have analysis
        
        // Create a reference to the original message
        message.duplicate_of_message_id = existingFile.messageId;
        
        logger?.info(`Using existing analysis for ${message.file_unique_id} from message ${existingFile.messageId}`);
      }
    }
    
    // Ensure we have a clean-up function in case of errors
    const cleanupOnError = async (error: any) => {
      try {
        // Check if a partial record was created that might be causing transaction issues
        if (error?.message?.includes('transaction') || error?.message?.includes('timeout') || error?.message?.includes('statement timeout') || error?.code === '2D000' || error?.code === '57014') {
          logger?.warn('Attempting to clean up potential transaction issues', { 
            message_id: message.telegram_message_id, 
            chat_id: message.chat_id,
            error_message: error?.message,
            error_code: error?.code
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
    
    // OPTIMIZATION: Instead of storing the entire telegram_data object,
    // just extract the essential metadata needed for processing
    // This significantly reduces the record size and prevents timeouts
    const essentialMetadata = {
      message_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      from_user_id: message.telegram_data?.from?.id,
      from_username: message.telegram_data?.from?.username,
      from_first_name: message.telegram_data?.from?.first_name,
      media_group_id: message.telegram_data?.media_group_id,
      date: message.telegram_data?.date,
      edit_date: message.telegram_data?.edit_date,
    };
    
    // Replace the entire telegram_data object with our minimal metadata
    const telegramMetadata = essentialMetadata;
    
    return await xdelo_withDatabaseRetry(`create_message_${message.telegram_message_id}`, async () => {
      try {
        // First insert the basic message data without large fields to prevent timeout
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
            // Store only essential metadata instead of full telegram_data
            telegram_data: telegramMetadata,
            is_forward: message.is_forward,
            forward_info: message.forward_info,
            correlation_id: message.correlation_id,
            message_url: message.message_url,
            created_at: now,
            updated_at: now,
            edit_history: message.edit_history || [],
            edit_date: message.edit_date,
            is_edited: !!message.edit_history?.length,
            // Add new fields for duplicate content handling
            is_duplicate_content: message.is_duplicate_content || false,
            analyzed_content: message.analyzed_content || null,
            duplicate_of_message_id: message.duplicate_of_message_id || null,
            processing_completed_at: message.is_duplicate_content ? now : null
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
      } catch (insertError: any) {
        // If there's an exception during the insert, clean up
        await cleanupOnError(insertError);
        throw insertError; // Re-throw for retry mechanism
      }
    }, {
      // Add special handling for transaction errors
      maxRetries: 5, // Increase retries for important operations
      initialDelayMs: 500, // Start with a shorter delay
      backoffFactor: 2, // Exponential backoff
      retryCondition: (error: any) => {
        // Don't retry on certain errors that won't be fixed by retrying
        if (error?.code === '23505') { // Unique violation
          logger?.warn('Not retrying on unique violation', { error: error.message });
          return false;
        }
        // Always retry on transaction errors and timeouts
        if (error?.message?.includes('transaction') || 
            error?.message?.includes('timeout') || 
            error?.message?.includes('statement timeout') ||
            error?.code === '2D000' ||
            error?.code === '57014') { // 57014 is the Postgres code for statement_timeout
          logger?.warn('Retrying on transaction/timeout error', { 
            error: error.message,
            code: error?.code 
          });
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

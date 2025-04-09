
import { 
  logProcessingEvent, 
  extractTelegramMetadata,
  createSupabaseClient,
  supabaseClient as sharedSupabaseClient 
} from '../_shared/consolidatedMessageUtils.ts';

/**
 * Enhanced Supabase client with improved timeout and retry capabilities
 */
<<<<<<< HEAD
export const supabaseClient = createSupabaseClient({ 
  timeoutSeconds: 30, 
  retryAttempts: 3 
});

/**
 * Log a processing event to the unified_audit_logs table
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: correlationId,
      logged_from: 'edge_function'
    };
    
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}
=======
export const supabaseClient = sharedSupabaseClient;
>>>>>>> 1c6afd6248d76680bdcec70142d877d46e874c8a

/**
 * Check if a message with the same Telegram message ID already exists in the database
 */
export async function checkDuplicateMessage(chatId: number, telegramMessageId: number): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('id')
    .eq('chat_id', chatId)
    .eq('telegram_message_id', telegramMessageId)
    .limit(1);
    
  if (error) {
    console.error('Error checking for duplicate message:', error);
    return false;
  }
  
  return data && data.length > 0;
}

/**
 * Creates a new non-media message record in the database with transaction support
 */
export async function createNonMediaMessage(
  input: {
    telegram_message_id: number;
    chat_id: number;
    chat_type: string;
    chat_title?: string;
    message_type: string;
    message_text?: string;
    telegram_data: any;
    telegram_metadata?: any;  // Add support for telegram_metadata
    processing_state?: string;
    is_forward?: boolean;
    correlation_id: string;
    message_url?: string;
  }
): Promise<{ id?: string; success: boolean; error?: string }> {
  try {
    // If telegram_metadata is not provided, extract it from telegram_data
    const telegramMetadata = input.telegram_metadata || extractTelegramMetadata(input.telegram_data);
    
    // Create the message record using a transaction for atomicity
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        message_type: input.message_type,
        text: input.message_text || '',
        telegram_data: input.telegram_data,
        telegram_metadata: telegramMetadata, // Store the extracted metadata
        processing_state: input.processing_state || 'initialized',
        is_forward: input.is_forward || false,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      console.error('Failed to create message record:', error);
      return { success: false, error: error.message };
    }
    
    return { id: data.id, success: true };
  } catch (error) {
    console.error('Exception in createNonMediaMessage:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Creates a new media message record in the database with transaction support
 */
export async function createMediaMessage(
  input: {
    telegram_message_id: number;
    chat_id: number;
    chat_type: string;
    chat_title?: string;
    caption?: string;
    file_id: string;
    file_unique_id: string;
    media_group_id?: string;
    mime_type?: string;
    file_size?: number;
    width?: number;
    height?: number;
    duration?: number;
    storage_path?: string;
    public_url?: string;
    telegram_data: any;
    processing_state?: string;
    is_forward?: boolean;
    correlation_id: string;
    message_url?: string;
    telegram_metadata?: any;
  }
): Promise<{ id?: string; success: boolean; error?: string }> {
  try {
    // Extract essential metadata only
    const telegramMetadata = input.telegram_metadata || extractTelegramMetadata(input.telegram_data);
    
    // Create the message record
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        caption: input.caption || '',
        file_id: input.file_id,
        file_unique_id: input.file_unique_id,
        media_group_id: input.media_group_id,
        mime_type: input.mime_type,
        file_size: input.file_size,
        width: input.width,
        height: input.height,
        duration: input.duration,
        storage_path: input.storage_path,
        public_url: input.public_url,
        telegram_metadata: telegramMetadata, // Store the minimal metadata
        processing_state: input.processing_state || 'initialized',
        is_forward: input.is_forward || false,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      console.error('Failed to create media message record:', error);
      return { success: false, error: error.message };
    }
    
    return { id: data.id, success: true };
  } catch (error) {
    console.error('Exception in createMediaMessage:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Creates a new message record in the database
 * This is a unified function that handles both media and non-media messages
 */
export async function createMessage(
  input: any, 
  logger?: any
): Promise<{ id?: string; success: boolean; error_message?: string }> {
  try {
    // Extract essential metadata
    const telegramMetadata = input.telegram_metadata || 
      (input.telegram_data ? extractTelegramMetadata(input.telegram_data) : {});
    
    // Create the message record
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        caption: input.caption || '',
        text: input.text || input.message_text || '',
        file_id: input.file_id,
        file_unique_id: input.file_unique_id,
        media_group_id: input.media_group_id,
        mime_type: input.mime_type,
        mime_type_original: input.mime_type_original,
        file_size: input.file_size,
        width: input.width,
        height: input.height,
        duration: input.duration,
        storage_path: input.storage_path,
        public_url: input.public_url,
        telegram_data: input.telegram_data,
        telegram_metadata: telegramMetadata,
        processing_state: input.processing_state || 'initialized',
        is_forward: input.is_forward || false,
        is_edited_channel_post: input.is_edited_channel_post || false,
        forward_info: input.forward_info,
        edit_date: input.edit_date,
        edit_history: input.edit_history || [],
        storage_exists: input.storage_exists,
        storage_path_standardized: input.storage_path_standardized,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      if (logger) logger.error('Failed to create message record:', error);
      return { success: false, error_message: error.message };
    }
    
    return { id: data.id, success: true };
  } catch (error) {
    if (logger) logger.error('Exception in createMessage:', error);
    return { 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Updates message state with enhanced error handling
 */
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string
): Promise<boolean> {
  if (!messageId) return false;
  
  try {
    const updates: Record<string, unknown> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };
    
    switch (state) {
      case 'processing':
        updates.processing_started_at = new Date().toISOString();
        break;
      case 'completed':
        updates.processing_completed_at = new Date().toISOString();
        updates.error_message = null;
        break;
      case 'error':
        if (errorMessage) {
          updates.error_message = errorMessage;
          updates.last_error_at = new Date().toISOString();
          updates.retry_count = supabaseClient.rpc('increment_retry_count', { message_id: messageId });
        }
        break;
    }
    
    const { error } = await supabaseClient
      .from('messages')
      .update(updates)
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error updating message state: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating message state: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Get message by ID with error handling
 */
export async function getMessageById(messageId: string) {
  if (!messageId) return null;
  
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error(`Error getting message: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error getting message: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Sync media group content from one message to others
 * Use the consolidated function from the database
 */
export async function syncMediaGroupContent(
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string,
  forceSync: boolean = false
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    // Call the dedicated function with proper parameters
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync,
        p_sync_edit_history: true
      }
    );
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true,
      updatedCount: data?.updated_count || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

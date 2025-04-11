// Import only what we need from this file - we'll keep most of the existing code
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { logWithCorrelation } from './logger.ts';

/**
 * Helper function to prepare JSON fields for PostgreSQL JSONB columns
 * Ensures consistent handling of null, string, and object values
 */
function prepareJsonField(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's a string that might be JSON, parse it
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // If it's not valid JSON, return as is
      return value;
    }
  }
  
  // Return objects as-is for proper JSONB handling
  return value;
}

/**
 * Simple, reliable formatter for PostgreSQL JSONB array type
 * 
 * This function handles the conversion between JavaScript arrays and PostgreSQL JSONB arrays
 * to prevent the "malformed array literal" error and ensure compatibility with database operations.
 * 
 * @param value - Array to format, or null/undefined
 * @returns PostgreSQL-compatible array string or null
 */
function formatPostgresArray(value: any): string | null {
  // Handle null case consistently
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty arrays - the most common cause of errors
  if (value === '[]' || (Array.isArray(value) && value.length === 0)) {
    return '{}';  // PostgreSQL empty array syntax
  }
  
  try {
    if (Array.isArray(value)) {
      // For non-empty arrays, create PostgreSQL array format directly
      // This is the most reliable approach without complex regex
      const formattedElements = value.map(item => {
        const jsonString = typeof item === 'string' ? item : JSON.stringify(item);
        // Escape quotes for PostgreSQL format
        return `"${jsonString.replace(/"/g, '\\"')}"`;
      });
      
      return `{${formattedElements.join(',')}}`;  // PostgreSQL array syntax
    }
    
    // Handle string that might be a JSON array
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return formatPostgresArray(parsed);
        }
      } catch {
        // Not a valid JSON array string
        return null;
      }
    }
  } catch (error) {
    // Always fail safely - empty array is better than a database error
    console.error("Error formatting PostgreSQL array:", error);
    return '{}';
  }
  
  // For any other case, return null
  return null;
}

/**
 * Smart Dispatcher for media message database operations
 * 
 * This function intelligently routes message processing to specialized PostgreSQL functions
 * based on message context. It implements a TypeScript dispatcher pattern that mirrors the
 * PostgreSQL smart_media_message_dispatcher, routing to one of three specialized functions:
 * 
 * 1. insert_new_media_message: For completely new messages
 * 2. update_duplicate_media_message: For duplicate media with potentially new captions
 * 3. update_edited_media_message: For explicit message edits with edit_date from Telegram
 * 
 * Benefits of this approach:
 * - Single responsibility: Each specialized function handles one scenario
 * - Improved error handling: More precise error messages
 * - Better array handling: Properly formats old_analyzed_content to prevent malformed array errors
 * - Audit logging: Enhanced logging of dispatch decisions for traceability
 * 
 * @returns Promise with success status, data (record ID), and any error details
 */
export async function upsertMediaMessageRecord({
  supabaseClient,
  messageId,
  chatId,
  caption,
  mediaType,
  fileId,
  fileUniqueId,
  storagePath,
  publicUrl,
  mimeType,
  extension,
  messageData,
  processingState,
  processingError,
  forwardInfo,
  mediaGroupId,
  captionData,
  analyzedContent,
  oldAnalyzedContent,
  correlationId,
  additionalUpdates = {}
}: {
  supabaseClient: SupabaseClient;
  messageId: number;                  // p_telegram_message_id (bigint)
  chatId: number;                     // p_chat_id (bigint)
  caption: string | null;             // p_caption (text)
  mediaType: string;                  // p_media_type (text) 
  fileId: string;                     // p_file_id (text)
  fileUniqueId: string;               // p_file_unique_id (text)
  storagePath: string;                // p_storage_path (text)
  publicUrl: string;                  // p_public_url (text)
  mimeType: string;                   // p_mime_type (text)
  extension: string;                  // p_extension (text)
  mediaType: string;                  // p_media_type (text) 
  caption: string | null;             // p_caption (text)
  processingState: string;            // p_processing_state (text -> processing_state_type)
  messageData: Record<string, any>;    // p_message_data (jsonb)
  correlationId: string;              // p_correlation_id (text)
  mediaGroupId?: string | null;       // p_media_group_id (text)
  forwardInfo?: Record<string, any>;  // p_forward_info (jsonb)
  processingError: string | null;     // p_processing_error (text)
  captionData?: Record<string, any>;  // p_caption_data (jsonb)
  analyzedContent?: Record<string, any>; // p_analyzed_content (jsonb)
  oldAnalyzedContent?: Record<string, any>[] | Record<string, any>; // p_old_analyzed_content (jsonb)
  additionalUpdates?: Record<string, any>; // Not a direct PostgreSQL parameter, used for additional fields
}): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    // Detect if this is an edited message (has edit_date)
    const isEditedMessage = messageData && 'edit_date' in messageData;
    if (isEditedMessage) {
      logWithCorrelation(correlationId, `Handling edited message with edit_date: ${messageData.edit_date}`, 'INFO', 'upsertMediaMessageRecord');
    }
    
    // Handle old_analyzed_content for jsonb type (now that the column is jsonb, not _jsonb array)
    // For jsonb columns, we simply need to pass the array as JSON - PostgreSQL will store it as a jsonb array
    let formattedOldAnalyzedContent;
    
    if (oldAnalyzedContent === null || oldAnalyzedContent === undefined) {
      // Default to empty array when null/undefined
      formattedOldAnalyzedContent = [];
      logWithCorrelation(correlationId, `No old_analyzed_content provided, using empty array`, 'DEBUG', 'upsertMediaMessageRecord');
    } else if (Array.isArray(oldAnalyzedContent)) {
      // Always pass arrays directly - PostgreSQL jsonb can store arrays directly
      formattedOldAnalyzedContent = oldAnalyzedContent;
      logWithCorrelation(correlationId, `Using provided old_analyzed_content with ${oldAnalyzedContent.length} items`, 'DEBUG', 'upsertMediaMessageRecord');
    } else {
      // If somehow not an array, try to handle it gracefully
      try {
        // If it's an object, wrap it in an array
        formattedOldAnalyzedContent = [oldAnalyzedContent];
        logWithCorrelation(correlationId, `Converted non-array old_analyzed_content to array format for jsonb compatibility`, 'WARN', 'upsertMediaMessageRecord');
      } catch (e) {
        // Default to empty array if all else fails
        formattedOldAnalyzedContent = [];
        logWithCorrelation(correlationId, `Failed to handle old_analyzed_content, using empty array`, 'ERROR', 'upsertMediaMessageRecord');
      }
    }
    
    // Log the operation start
    logWithCorrelation(
      correlationId, 
      `Smart dispatching media message: messageId=${messageId}, chatId=${chatId}, fileUniqueId=${fileUniqueId}`, 
      'INFO', 
      'upsertMediaMessageRecord'
    );
    
    // Prepare parameters - use explicit empty string for TEXT fields
    // and null for JSONB fields when they're missing
    const params = {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_file_unique_id: fileUniqueId,
      p_file_id: fileId,
      p_storage_path: storagePath || '',
      p_public_url: publicUrl || '',
      p_mime_type: mimeType || '',
      p_extension: extension || '',
      p_media_type: mediaType || '',
      p_caption: caption || '',
      p_processing_state: processingState || 'pending',
      p_message_data: messageData || {},
      p_correlation_id: correlationId,
      p_user_id: messageData?.from?.id || null,
      p_media_group_id: mediaGroupId || null,
      p_forward_info: forwardInfo || null,
      p_processing_error: processingError || '',  // TEXT type needs empty string, not null
      p_caption_data: captionData || null,        // JSONB can be null
      p_analyzed_content: analyzedContent || null, // JSONB can be null
      p_old_analyzed_content: formattedOldAnalyzedContent
    };
    
    // Call the smart dispatcher stored procedure
    const result = await supabaseClient.rpc('smart_media_message_dispatcher', params);
    
    if (result.error) {
      throw new Error(`Smart dispatcher failed: ${result.error.message}`);
    }
    
    // Apply any additional updates if needed
    if (additionalUpdates && Object.keys(additionalUpdates).length > 0 && result.data) {
      await applyAdditionalUpdates(supabaseClient, result.data, additionalUpdates, correlationId);
    }
    
    // Return the complete record
    return await fetchCompleteRecord(supabaseClient, result.data, correlationId);
  } catch (error) {
    // Log the error and return a consistent error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Database error: ${errorMessage}`, 'ERROR', 'upsertMediaMessageRecord');
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper function to apply additional updates to a message record
 */
async function applyAdditionalUpdates(
  supabaseClient: SupabaseClient, 
  messageId: string, 
  additionalUpdates: Record<string, any>,
  correlationId: string
): Promise<void> {
  try {
    // These fields are handled directly in the database function, don't duplicate them
    const filteredUpdates = { ...additionalUpdates };
    delete filteredUpdates.old_analyzed_content;
    delete filteredUpdates.analyzed_content;
    delete filteredUpdates.caption_data;
    
    if (Object.keys(filteredUpdates).length > 0) {
      logWithCorrelation(
        correlationId, 
        `Applying additional updates: ${JSON.stringify(Object.keys(filteredUpdates))}`, 
        'DEBUG', 
        'applyAdditionalUpdates'
      );
      
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(filteredUpdates)
        .eq('id', messageId);
        
      if (updateError) {
        logWithCorrelation(correlationId, `Error applying additional updates: ${updateError.message}`, 'WARN', 'applyAdditionalUpdates');
      }
    }
  } catch (updateError) {
    logWithCorrelation(
      correlationId, 
      `Exception applying additional updates: ${updateError instanceof Error ? updateError.message : String(updateError)}`, 
      'WARN', 
      'applyAdditionalUpdates'
    );
  }
}

/**
 * Helper function to fetch a complete record by ID
 */
async function fetchCompleteRecord(
  supabaseClient: SupabaseClient, 
  messageId: string, 
  correlationId: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const { data: completeRecord, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      logWithCorrelation(correlationId, `Error fetching complete record: ${fetchError.message}`, 'WARN', 'fetchCompleteRecord');
      return { success: true, data: messageId };
    }
    
    return { success: true, data: completeRecord };
  } catch (fetchError) {
    // If fetching fails, still return success with the ID
    logWithCorrelation(
      correlationId, 
      `Exception fetching complete record: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`, 
      'WARN', 
      'fetchCompleteRecord'
    );
    return { success: true, data: messageId };
  }
}

/**
 * Create a message record in the database
 */
export async function createMessageRecord(
  supabaseClient: SupabaseClient,
  message: any,
  mediaType: string,
  fileId: string,
  fileUniqueId: string,
  storagePath: string,
  publicUrl: string,
  mimeType: string,
  extension: string,
  captionData: any,
  correlationId: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          message_date: new Date(message.date * 1000).toISOString(),
          caption: message.caption,
          media_type: mediaType,
          file_id: fileId,
          file_unique_id: fileUniqueId,
          storage_path: storagePath,
          public_url: publicUrl,
          mime_type: mimeType,
          extension: extension,
          message_data: message,
          processing_state: "pending",
          caption_data: captionData,
          analyzed_content: captionData,
          correlation_id: correlationId,
          edit_history: []
        }
      ])
      .select()
      .single();
      
    if (error) {
      console.error("DB error creating message:", error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error("Exception creating message:", error);
    return { success: false, error };
  }
}

/**
 * Update a message record in the database
 */
export async function updateMessageRecord(
  supabaseClient: SupabaseClient,
  existingMessage: any,
  message: any,
  mediaInfo: {
    fileUniqueId: string;
    storagePath: string;
    publicUrl: string;
    mimeType: string;
    extension: string;
  } | null,
  captionData: any,
  correlationId: string,
  updates: any = {}
): Promise<boolean> {
  try {
    const updateData: any = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      message_data: message,
      caption_data: captionData,
      analyzed_content: captionData,
      correlation_id: correlationId,
      updated_at: new Date().toISOString(),
      ...updates
    };
    
    if (mediaInfo) {
      updateData.file_unique_id = mediaInfo.fileUniqueId;
      updateData.storage_path = mediaInfo.storagePath;
      updateData.public_url = mediaInfo.publicUrl;
      updateData.mime_type = mediaInfo.mimeType;
      updateData.extension = mediaInfo.extension;
    }
    
    const { error } = await supabaseClient
      .from("messages")
      .update(updateData)
      .eq("id", existingMessage.id);
      
    if (error) {
      console.error("DB error updating message:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Exception updating message:", error);
    return false;
  }
}

/**
 * Find a message by Telegram message ID and chat ID
 */
export async function findMessageByTelegramId(
  supabaseClient: SupabaseClient,
  telegramMessageId: number,
  chatId: number,
  correlationId: string
): Promise<{ success: boolean; message?: any }> {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("telegram_message_id", telegramMessageId)
      .eq("chat_id", chatId)
      .single();
      
    if (error) {
      // Not found is not an error
      if (error.message.includes('No rows found')) {
        return { success: false };
      }
      
      console.error(`DB error finding message by Telegram ID ${telegramMessageId} in chat ${chatId}:`, error);
      return { success: false };
    }
    
    return { success: true, message: data };
  } catch (error) {
    console.error(`Exception finding message by Telegram ID ${telegramMessageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Find a message by file_unique_id
 */
export async function findMessageByFileUniqueId(
  supabaseClient: SupabaseClient,
  fileUniqueId: string,
  correlationId: string
): Promise<{ success: boolean; data?: any }> {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .single();
      
    if (error) {
      // Not found is not an error
      if (error.message.includes('No rows found')) {
        return { success: false };
      }
      
      console.error(`DB error finding message by file_unique_id ${fileUniqueId}:`, error);
      return { success: false };
    }
    
    return { success: true, data: data };
  } catch (error) {
    console.error(`Exception finding message by file_unique_id ${fileUniqueId}:`, error);
    return { success: false };
  }
}

/**
 * Update a message with an error
 */
export async function updateMessageWithError(
  supabaseClient: SupabaseClient,
  messageId: string,
  errorMessage: string,
  correlationId: string,
  errorType?: string
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from("messages")
      .update({
        processing_state: "error",
        error_message: errorMessage,
        error_type: errorType,
        last_error_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq("id", messageId);
      
    if (error) {
      console.error("DB error updating message with error:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Exception updating message with error:", error);
    return false;
  }
}

/**
 * Log a processing event
 */
export async function logProcessingEvent(
  supabaseClient: SupabaseClient,
  event_type: string,
  entity_id: string,
  correlation_id: string,
  metadata: Record<string, any>,
  error?: any
): Promise<void> {
  try {
    const { error: dbError } = await supabaseClient
      .from("unified_audit_logs")
      .insert({
        event_type: event_type,
        entity_id: entity_id,
        correlation_id: correlation_id,
        metadata: metadata,
        error_message: error ? (error instanceof Error ? error.message : String(error)) : null
      });
      
    if (dbError) {
      console.error("DB error logging processing event:", dbError);
    }
  } catch (e) {
    console.error("Exception logging processing event:", e);
  }
}

/**
 * Trigger caption parsing by invoking an Edge Function
 */
export async function triggerCaptionParsing({
  supabaseClient,
  messageId,
  correlationId
}: {
  supabaseClient: SupabaseClient;
  messageId: string;
  correlationId: string;
}): Promise<void> {
  try {
    const { data, error } = await supabaseClient.functions.invoke('xdelo_parse_caption', {
      body: {
        messageId: messageId,
        correlationId: correlationId
      }
    });
    
    if (error) {
      console.error(`Error invoking caption parsing function for message ${messageId}:`, error);
    } else {
      console.log(`Caption parsing triggered successfully for message ${messageId}`);
    }
  } catch (e) {
    console.error(`Exception invoking caption parsing function for message ${messageId}:`, e);
  }
}

/**
 * Find messages by media group ID
 */
export async function findMessagesByMediaGroupId(
  supabaseClient: SupabaseClient,
  mediaGroupId: string,
  correlationId: string
): Promise<{ success: boolean; messages?: any[] }> {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId);
      
    if (error) {
      console.error(`DB error finding messages by media group ID ${mediaGroupId}:`, error);
      return { success: false };
    }
    
    return { success: true, messages: data };
  } catch (error) {
    console.error(`Exception finding messages by media group ID ${mediaGroupId}:`, error);
    return { success: false };
  }
}

/**
 * Sync media group captions across all messages in a media group
 * Uses the PostgreSQL sync_media_group_captions function to synchronize:
 * - caption
 * - analyzed_content (derived from caption_data)
 * - old_analyzed_content (archives history of caption analysis)
 * - processing_state
 * 
 * @returns Promise with success/error result object consistent with other DB operations
 */
interface SyncMediaGroupCaptionsParams {
  supabaseClient: SupabaseClient;
  mediaGroupId: string;
  sourceMessageId?: string;
  newCaption?: string | null;
  captionData?: any;
  processingState?: string;
  correlationId: string;
}

export async function syncMediaGroupCaptions({
  supabaseClient,
  mediaGroupId,
  sourceMessageId,
  newCaption,
  captionData,
  processingState = 'pending_analysis',
  correlationId
}: SyncMediaGroupCaptionsParams): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    // Validation - only mediaGroupId is critical
    if (!mediaGroupId) {
      const errorMsg = 'Media group ID is required for caption synchronization';
      logWithCorrelation(
        correlationId, 
        errorMsg, 
        'ERROR', 
        'syncMediaGroupCaptions'
      );
      return { success: false, error: errorMsg };
    }
    
    logWithCorrelation(
      correlationId, 
      `Syncing captions for media group ${mediaGroupId}${sourceMessageId ? ` from source message ${sourceMessageId}` : ''}`, 
      'INFO', 
      'syncMediaGroupCaptions'
    );
    
    // Ensure captionData is a proper object for JSONB conversion
    const preparedCaptionData = typeof captionData === 'string' 
      ? JSON.parse(captionData) 
      : captionData || {};
    
    // Debug the parameters to help identify issues
    logWithCorrelation(
      correlationId, 
      `Calling sync_media_group_captions with mediaGroupId=${mediaGroupId}, sourceMessageId=${sourceMessageId || 'none'}`, 
      'DEBUG', 
      'syncMediaGroupCaptions'
    );
    
    // Call the PostgreSQL function with properly typed parameters
    // The PostgreSQL function has been updated to handle null parameters gracefully
    const { data, error } = await supabaseClient.rpc('sync_media_group_captions', {
      p_media_group_id: mediaGroupId,
      p_exclude_message_id: sourceMessageId,
      p_caption: newCaption,
      p_caption_data: preparedCaptionData,
      p_processing_state: processingState
    });
    
    if (error) {
      logWithCorrelation(
        correlationId, 
        `Error syncing captions for media group ${mediaGroupId}: ${error.message}`, 
        'ERROR', 
        'syncMediaGroupCaptions'
      );
      
      // Log a detailed error with parameter types for troubleshooting
      await logProcessingEvent(
        supabaseClient,
        'media_group_sync_error',
        sourceMessageId,
        correlationId,
        {
          media_group_id: mediaGroupId,
          caption: newCaption,
          params: {
            p_media_group_id_type: typeof mediaGroupId,
            p_exclude_message_id_type: typeof sourceMessageId,
            p_caption_type: typeof newCaption,
            p_caption_data_type: typeof preparedCaptionData,
            p_processing_state_type: typeof processingState
          }
        },
        error.message
      );
      
      return { success: false, error };
    } else {
      const updatedCount = Array.isArray(data) ? data.length : 0;
      logWithCorrelation(
        correlationId, 
        `Successfully synced captions for ${updatedCount} messages in media group ${mediaGroupId}`, 
        'INFO', 
        'syncMediaGroupCaptions'
      );
      
      // Log success event
      await logProcessingEvent(
        supabaseClient,
        'media_group_sync_success',
        sourceMessageId,
        correlationId,
        {
          media_group_id: mediaGroupId,
          caption: newCaption,
          updated_messages: updatedCount,
          synchronized_fields: ['caption', 'analyzed_content', 'old_analyzed_content', 'processing_state']
        }
      );
      
      return { success: true, data };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(
      correlationId, 
      `Exception syncing media group captions for media group ${mediaGroupId}: ${errorMessage}`, 
      'ERROR', 
      'syncMediaGroupCaptions'
    );
    
    // Log the exception with stack trace for debugging
    await logProcessingEvent(
      supabaseClient,
      'media_group_sync_exception',
      sourceMessageId,
      correlationId,
      {
        media_group_id: mediaGroupId,
        caption: newCaption,
        stack: error instanceof Error ? error.stack : undefined
      },
      errorMessage
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Extract forward information from a message
 */
export function extractForwardInfo(message: any): any {
  if (message.forward_from) {
    return {
      forwarded_from_type: 'user',
      forwarded_from_id: message.forward_from.id,
      forwarded_from_username: message.forward_from.username,
      forwarded_date: new Date(message.forward_date * 1000).toISOString()
    };
  } else if (message.forward_from_chat) {
    return {
      forwarded_from_type: message.forward_from_chat.type,
      forwarded_from_id: message.forward_from_chat.id,
      forwarded_from_title: message.forward_from_chat.title,
      forwarded_from_username: message.forward_from_chat.username,
      forwarded_date: new Date(message.forward_date * 1000).toISOString()
    };
  } else {
    return null;
  }
}

/**
 * Upsert a text message record in the database
 */
export async function upsertTextMessageRecord({
  supabaseClient,
  messageId,
  chatId,
  messageText,
  messageData,
  chatType,
  chatTitle,
  forwardInfo,
  processingState,
  processingError,
  correlationId
}: {
  supabaseClient: SupabaseClient;
  messageId: number;
  chatId: number;
  messageText: string | null;
  messageData: any;
  chatType: string | null;
  chatTitle: string | null;
  forwardInfo?: any;
  processingState: string;
  processingError: string | null;
  correlationId: string;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Upserting text message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertTextMessageRecord');
    
    // Call the RPC function to upsert the text message - parameters must match the database function signature
    const { data, error } = await supabaseClient.rpc('upsert_text_message', {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_message_text: messageText,
      p_message_data: messageData,
      p_correlation_id: correlationId,  // Moved to 5th position to match DB function signature
      p_chat_type: chatType,
      p_chat_title: chatTitle,
      p_forward_info: forwardInfo,
      p_processing_state: processingState,
      p_processing_error: processingError
    });
    
    if (error) {
      logWithCorrelation(correlationId, `Error upserting text message: ${error.message}`, 'ERROR', 'upsertTextMessageRecord');
      console.error("DB error upserting text message:", error);
      return { success: false, error };
    }
    
    // Fetch the complete record
    if (data) {
      const { data: completeRecord, error: fetchError } = await supabaseClient
        .from('other_messages')
        .select('*')
        .eq('id', data)
        .single();
        
      if (fetchError) {
        logWithCorrelation(correlationId, `Warning: Successfully upserted text message with ID ${data}, but failed to fetch complete record: ${fetchError.message}`, 'WARN', 'upsertTextMessageRecord');
        return { success: true, data };
      }
      
      return { success: true, data: completeRecord };
    }
    
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception upserting text message: ${errorMessage}`, 'ERROR', 'upsertTextMessageRecord');
    console.error("Exception upserting text message:", error);
    return { success: false, error: errorMessage };
  }
}

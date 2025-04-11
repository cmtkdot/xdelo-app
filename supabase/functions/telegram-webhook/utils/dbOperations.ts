// Import only what we need from this file - we'll keep most of the existing code
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { logWithCorrelation } from './logger.ts';

/**
 * Upsert a media message record in the database
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
  messageId: number;
  chatId: number;
  caption: string | null;
  mediaType: string;
  fileId: string;
  fileUniqueId: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  extension: string;
  messageData: any;
  processingState: string;
  processingError: string | null;
  forwardInfo?: any;
  mediaGroupId?: string | null;
  captionData?: any;
  analyzedContent?: any;
  oldAnalyzedContent?: any[];
  correlationId: string;
  additionalUpdates?: Record<string, any>;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Upserting media message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertMediaMessageRecord');
    
    // Prepare parameters for the upsert_media_message function with consistent naming
    // and proper handling of analyzed_content and old_analyzed_content
    const rpcParams: Record<string, any> = {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_file_unique_id: fileUniqueId,
      p_file_id: fileId,
      p_storage_path: storagePath,
      p_public_url: publicUrl,
      p_mime_type: mimeType,
      p_extension: extension,
      p_media_type: mediaType,
      p_caption: caption,
      p_processing_state: processingState,
      p_message_data: messageData,
      p_correlation_id: correlationId,
      p_media_group_id: mediaGroupId,
      p_forward_info: forwardInfo,
      p_processing_error: processingError,
      p_caption_data: captionData,
      p_analyzed_content: analyzedContent || captionData, // Directly use the analyzed_content parameter
      p_old_analyzed_content: oldAnalyzedContent // Use old_analyzed_content for history tracking
    };
    
    // Log the parameters being passed for debugging
    logWithCorrelation(
      correlationId, 
      `Calling upsert_media_message with caption_data and analyzed_content: ${JSON.stringify({ 
        caption_data: captionData ? '[set]' : '[not set]', 
        analyzed_content: analyzedContent ? '[set]' : '[not set]' 
      })}`, 
      'DEBUG', 
      'upsertMediaMessageRecord'
    );
    
    // Call the RPC function with the enhanced parameter set
    const { data, error } = await supabaseClient.rpc('upsert_media_message', rpcParams);
    
    if (error) {
      logWithCorrelation(correlationId, `Error upserting media message: ${error.message}`, 'ERROR', 'upsertMediaMessageRecord');
      console.error("DB error upserting media message:", error);
      return { success: false, error };
    }
    
    // Apply any additional updates if needed that weren't handled by the RPC call
    if (Object.keys(additionalUpdates).length > 0 && data) {
      try {
        // These fields are now handled directly in the RPC call, don't duplicate them in additionalUpdates
        const filteredUpdates = { ...additionalUpdates };
        delete filteredUpdates.old_analyzed_content;
        delete filteredUpdates.analyzed_content;
        delete filteredUpdates.caption_data;
        
        if (Object.keys(filteredUpdates).length > 0) {
          logWithCorrelation(
            correlationId, 
            `Applying additional updates: ${JSON.stringify(Object.keys(filteredUpdates))}`, 
            'DEBUG', 
            'upsertMediaMessageRecord'
          );
          
          const { error: updateError } = await supabaseClient
            .from('messages')
            .update(filteredUpdates)
            .eq('id', data);
            
          if (updateError) {
            logWithCorrelation(correlationId, `Error applying additional updates: ${updateError.message}`, 'WARN', 'upsertMediaMessageRecord');
          }
        }
      } catch (updateError) {
        logWithCorrelation(correlationId, `Exception applying additional updates: ${updateError.message}`, 'WARN', 'upsertMediaMessageRecord');
      }
    }
    
    // Fetch the complete record to return the full state
    if (data) {
      const { data: completeRecord, error: fetchError } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('id', data)
        .single();
        
      if (fetchError) {
        logWithCorrelation(correlationId, `Error fetching complete record: ${fetchError.message}`, 'WARN', 'upsertMediaMessageRecord');
        return { success: true, data };
      }
      
      return { success: true, data: completeRecord };
    }
    
    return { success: true, data };
  } catch (error) {
    logWithCorrelation(correlationId, `Exception upserting media message: ${error.message}`, 'ERROR', 'upsertMediaMessageRecord');
    console.error("Exception upserting media message:", error);
    return { success: false, error: error.message || String(error) };
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

import { supabaseClient } from '../../_shared/supabaseClient.ts';
import { logWithCorrelation } from './logger.ts';
import { validateChatType, ProcessingState } from '../../_shared/db-functions.ts';

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
  processingError = null,
  forwardInfo = null,
  mediaGroupId = null,
  captionData = null,
  analyzedContent = null,
  oldAnalyzedContent = null,
  correlationId,
  additionalUpdates = {}
}: {
  supabaseClient: any;
  messageId: number;
  chatId: number;
  caption: string | null;
  mediaType: string;
  fileId: string;
  fileUniqueId: string;
  storagePath: string | null;
  publicUrl: string | null;
  mimeType: string | null;
  extension: string | null;
  messageData: any;
  processingState: string;
  processingError?: string | null;
  forwardInfo?: any;
  mediaGroupId?: string | null;
  captionData?: any;
  analyzedContent?: any;
  oldAnalyzedContent?: any;
  correlationId: string;
  additionalUpdates?: Record<string, any>;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Upserting media message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertMediaMessageRecord');
    
    // Ensure captionData is properly formatted as JSONB
    let formattedCaptionData = captionData;
    if (captionData) {
      if (typeof captionData === 'string') {
        // If it's a string that looks like JSON, parse it
        if (captionData.trim().startsWith('{') || captionData.trim().startsWith('[')) {
          try {
            formattedCaptionData = JSON.parse(captionData);
          } catch (e) {
            formattedCaptionData = { text: captionData };
          }
        } else {
          formattedCaptionData = { text: captionData };
        }
      }
      // Otherwise leave as is (assuming it's already an object)
    }
    
    // Handle oldAnalyzedContent properly as JSONB or null
    let formattedOldAnalyzedContent = null;
    
    // Only pass oldAnalyzedContent if it has content
    if (oldAnalyzedContent) {
      // Convert to array if it's not already one
      if (!Array.isArray(oldAnalyzedContent)) {
        formattedOldAnalyzedContent = JSON.stringify([oldAnalyzedContent]);
      } else if (oldAnalyzedContent.length > 0) {
        formattedOldAnalyzedContent = JSON.stringify(oldAnalyzedContent);
      }
    }
    
    logWithCorrelation(
      correlationId, 
      `Calling upsert_media_message with caption_data and analyzed_content: ${JSON.stringify({
        caption_data: captionData ? '[set]' : '[not set]',
        analyzed_content: analyzedContent ? '[set]' : '[not set]',
        old_analyzed_content: formattedOldAnalyzedContent ? '[set]' : '[not set]'
      })}`, 
      'INFO', 
      'upsertMediaMessageRecord'
    );
    
    // Call database function with parameters in the correct order
    const { data, error } = await supabaseClient.rpc('upsert_media_message', {
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
      p_user_id: null, // Ignored by the function, kept for compatibility
      p_media_group_id: mediaGroupId,
      p_forward_info: forwardInfo,
      p_processing_error: processingError,
      p_caption_data: formattedCaptionData, // Now properly sent as JSONB
      p_old_analyzed_content: formattedOldAnalyzedContent, // Properly formatted as JSONB
      p_analyzed_content: analyzedContent
    });

    if (error) {
      logWithCorrelation(
        correlationId, 
        `Error upserting media message: ${error.message}`, 
        'ERROR', 
        'upsertMediaMessageRecord'
      );
      return { success: false, error };
    }

    logWithCorrelation(
      correlationId, 
      `Successfully upserted media message with ID: ${data}`, 
      'INFO', 
      'upsertMediaMessageRecord'
    );
    
    return { success: true, data };
  } catch (error) {
    logWithCorrelation(
      correlationId, 
      `Exception in upsertMediaMessageRecord: ${error}`, 
      'ERROR', 
      'upsertMediaMessageRecord'
    );
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Create a message record in the database
 */
export async function createMessageRecord(supabaseClient, message, mediaType, fileId, fileUniqueId, storagePath, publicUrl, mimeType, extension, captionData, correlationId) {
  try {
    const { data, error } = await supabaseClient.from("messages").insert([
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
    ]).select().single();
    if (error) {
      console.error("DB error creating message:", error);
      return {
        success: false,
        error
      };
    }
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error("Exception creating message:", error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Update a message record in the database
 */
export async function updateMessageRecord(supabaseClient, existingMessage, message, mediaInfo, captionData, correlationId, updates = {}) {
  try {
    const updateData = {
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
    const { error } = await supabaseClient.from("messages").update(updateData).eq("id", existingMessage.id);
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
  supabaseClient: any,
  telegramMessageId: number,
  chatId: number,
  correlationId: string
): Promise<{ success: boolean; message?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Finding message with Telegram ID ${telegramMessageId} in chat ${chatId}`, 'INFO', 'findMessageByTelegramId');
    
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId)
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found, which is a valid result
        logWithCorrelation(correlationId, `Message ${telegramMessageId} not found in chat ${chatId}`, 'INFO', 'findMessageByTelegramId');
        return { success: true, message: null };
      }
      
      logWithCorrelation(correlationId, `Error finding message: ${error.message}`, 'ERROR', 'findMessageByTelegramId');
      return { success: false, error };
    }
    
    logWithCorrelation(correlationId, `Found message ${telegramMessageId} in chat ${chatId}`, 'INFO', 'findMessageByTelegramId');
    return { success: true, message: data };
  } catch (error) {
    logWithCorrelation(correlationId, `Exception in findMessageByTelegramId: ${error}`, 'ERROR', 'findMessageByTelegramId');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Find a message by file_unique_id
 */
export async function findMessageByFileUniqueId(
  supabaseClient: any,
  fileUniqueId: string,
  correlationId: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Finding message with file_unique_id ${fileUniqueId}`, 'INFO', 'findMessageByFileUniqueId');
    
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found, which is a valid result
        logWithCorrelation(correlationId, `Message with file_unique_id ${fileUniqueId} not found`, 'INFO', 'findMessageByFileUniqueId');
        return { success: true, data: null };
      }
      
      logWithCorrelation(correlationId, `Error finding message by file_unique_id: ${error.message}`, 'ERROR', 'findMessageByFileUniqueId');
      return { success: false, error };
    }
    
    logWithCorrelation(correlationId, `Found message with file_unique_id ${fileUniqueId}`, 'INFO', 'findMessageByFileUniqueId');
    return { success: true, data };
  } catch (error) {
    logWithCorrelation(correlationId, `Exception in findMessageByFileUniqueId: ${error}`, 'ERROR', 'findMessageByFileUniqueId');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Update a message with an error
 */
export async function updateMessageWithError(supabaseClient, messageId, errorMessage, correlationId, errorType) {
  try {
    const { error } = await supabaseClient.from("messages").update({
      processing_state: "error",
      error_message: errorMessage,
      error_type: errorType,
      last_error_at: new Date().toISOString(),
      correlation_id: correlationId
    }).eq("id", messageId);
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
export async function logProcessingEvent(supabaseClient, event_type, entity_id, correlation_id, metadata, error) {
  try {
    const { error: dbError } = await supabaseClient.from("unified_audit_logs").insert({
      event_type: event_type,
      entity_id: entity_id,
      correlation_id: correlation_id,
      metadata: metadata,
      error_message: error ? error instanceof Error ? error.message : String(error) : null
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
export async function triggerCaptionParsing({ supabaseClient, messageId, correlationId }) {
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
export async function findMessagesByMediaGroupId(supabaseClient, mediaGroupId, correlationId) {
  try {
    const { data, error } = await supabaseClient.from("messages").select("*").eq("media_group_id", mediaGroupId);
    if (error) {
      console.error(`DB error finding messages by media group ID ${mediaGroupId}:`, error);
      return {
        success: false
      };
    }
    return {
      success: true,
      messages: data
    };
  } catch (error) {
    console.error(`Exception finding messages by media group ID ${mediaGroupId}:`, error);
    return {
      success: false
    };
  }
}

/**
 * Sync captions for media group messages
 */
export async function syncMediaGroupCaptions({ 
  supabaseClient, 
  mediaGroupId, 
  sourceMessageId, 
  newCaption, 
  captionData, 
  processingState = 'pending_analysis', 
  correlationId 
}) {
  try {
    // Validation - only mediaGroupId is critical
    if (!mediaGroupId) {
      const errorMsg = 'Media group ID is required for caption synchronization';
      logWithCorrelation(correlationId, errorMsg, 'ERROR', 'syncMediaGroupCaptions');
      return {
        success: false,
        error: errorMsg
      };
    }
    
    logWithCorrelation(correlationId, `Syncing captions for media group ${mediaGroupId}${sourceMessageId ? ` from source message ${sourceMessageId}` : ''}`, 'INFO', 'syncMediaGroupCaptions');
    
    // Ensure captionData is a proper object for JSONB conversion
    // Same pattern as in upsertMediaMessageRecord
    const preparedCaptionData = typeof captionData === 'string' ? 
      (captionData.trim().startsWith('{') || captionData.trim().startsWith('[') ? 
        JSON.parse(captionData) : { text: captionData }) : 
      captionData || {};
    
    // Debug the parameters to help identify issues
    logWithCorrelation(correlationId, `Calling sync_media_group_captions with mediaGroupId=${mediaGroupId}, sourceMessageId=${sourceMessageId || 'none'}`, 'DEBUG', 'syncMediaGroupCaptions');
    
    // Call the PostgreSQL function with properly typed parameters
    const { data, error } = await supabaseClient.rpc('sync_media_group_captions', {
      p_media_group_id: mediaGroupId,
      p_exclude_message_id: sourceMessageId,
      p_caption: newCaption,
      p_caption_data: preparedCaptionData,
      p_processing_state: processingState
    });
    
    if (error) {
      logWithCorrelation(correlationId, `Error syncing captions for media group ${mediaGroupId}: ${error.message}`, 'ERROR', 'syncMediaGroupCaptions');
      
      // Log a detailed error with parameter types for troubleshooting
      await logProcessingEvent(supabaseClient, 'media_group_sync_error', sourceMessageId, correlationId, {
        media_group_id: mediaGroupId,
        caption: newCaption,
        params: {
          p_media_group_id_type: typeof mediaGroupId,
          p_exclude_message_id_type: typeof sourceMessageId,
          p_caption_type: typeof newCaption,
          p_caption_data_type: typeof preparedCaptionData,
          p_processing_state_type: typeof processingState
        }
      }, error.message);
      
      return {
        success: false,
        error
      };
    } else {
      const updatedCount = Array.isArray(data) ? data.length : 0;
      logWithCorrelation(correlationId, `Successfully synced captions for ${updatedCount} messages in media group ${mediaGroupId}`, 'INFO', 'syncMediaGroupCaptions');
      
      // Log success event
      await logProcessingEvent(supabaseClient, 'media_group_sync_success', sourceMessageId, correlationId, {
        media_group_id: mediaGroupId,
        caption: newCaption,
        updated_messages: updatedCount,
        synchronized_fields: [
          'caption',
          'analyzed_content',
          'old_analyzed_content',
          'processing_state'
        ]
      });
      
      return {
        success: true,
        data
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception syncing media group captions for media group ${mediaGroupId}: ${errorMessage}`, 'ERROR', 'syncMediaGroupCaptions');
    
    // Log the exception with stack trace for debugging
    await logProcessingEvent(supabaseClient, 'media_group_sync_exception', sourceMessageId, correlationId, {
      media_group_id: mediaGroupId,
      caption: newCaption,
      stack: error instanceof Error ? error.stack : undefined
    }, errorMessage);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Extract forward information from a message
 */
export function extractForwardInfo(message: any): any {
  if (!message) return null;
  
  const forwardInfo = {};
  
  // Check for forwarded message attributes
  if (message.forward_from) {
    Object.assign(forwardInfo, {
      is_forwarded: true,
      forward_from: message.forward_from,
      forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : null
    });
  }
  
  if (message.forward_from_chat) {
    Object.assign(forwardInfo, {
      is_forwarded: true,
      forward_from_chat: message.forward_from_chat,
      forward_from_message_id: message.forward_from_message_id,
      forward_signature: message.forward_signature,
      forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : null
    });
  }
  
  // Return null if no forwarding info was found
  return Object.keys(forwardInfo).length > 0 ? forwardInfo : null;
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
}) {
  try {
    logWithCorrelation(correlationId, `Upserting text message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertTextMessageRecord');
    
    // Call the RPC function to upsert the text message - parameters must match the database function signature
    const { data, error } = await supabaseClient.rpc('upsert_text_message', {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_message_text: messageText,
      p_message_data: messageData,
      p_correlation_id: correlationId,
      p_chat_type: chatType,
      p_chat_title: chatTitle,
      p_forward_info: forwardInfo,
      p_processing_state: processingState,
      p_processing_error: processingError
    });
    
    if (error) {
      logWithCorrelation(correlationId, `Error upserting text message: ${error.message}`, 'ERROR', 'upsertTextMessageRecord');
      console.error("DB error upserting text message:", error);
      return {
        success: false,
        error
      };
    }
    
    // Fetch the complete record
    if (data) {
      const { data: completeRecord, error: fetchError } = await supabaseClient.from('other_messages').select('*').eq('id', data).single();
      
      if (fetchError) {
        logWithCorrelation(correlationId, `Warning: Successfully upserted text message with ID ${data}, but failed to fetch complete record: ${fetchError.message}`, 'WARN', 'upsertTextMessageRecord');
        return {
          success: true,
          data
        };
      }
      
      return {
        success: true,
        data: completeRecord
      };
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception upserting text message: ${errorMessage}`, 'ERROR', 'upsertTextMessageRecord');
    console.error("Exception upserting text message:", error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

export default {
  upsertMediaMessageRecord,
  findMessageByTelegramId,
  findMessageByFileUniqueId,
  extractForwardInfo,
  upsertTextMessageRecord,
};

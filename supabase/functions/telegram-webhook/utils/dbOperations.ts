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
  correlationId: string;
  additionalUpdates?: Record<string, any>;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    logWithCorrelation(correlationId, `Upserting media message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertMediaMessageRecord');
    
    // Call the RPC function to upsert the media message - ensure parameters match the exact database function signature
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
      p_processing_state: processingState, // Passed as string, will be cast in the function
      p_message_data: messageData,
      p_correlation_id: correlationId,
      p_media_group_id: mediaGroupId,
      p_forward_info: forwardInfo,
      p_processing_error: processingError,
      p_caption_data: captionData || analyzedContent,
      p_old_analyzed_content: additionalUpdates.old_analyzed_content,
      p_analyzed_content: additionalUpdates.analyzed_content || captionData || analyzedContent
    });
    
    if (error) {
      logWithCorrelation(correlationId, `Error upserting media message: ${error.message}`, 'ERROR', 'upsertMediaMessageRecord');
      console.error("DB error upserting media message:", error);
      return { success: false, error };
    }
    
    // Apply any additional updates if needed
    if (Object.keys(additionalUpdates).length > 0 && data) {
      try {
        // Filter out updates that were already applied via the RPC
        const filteredUpdates = { ...additionalUpdates };
        delete filteredUpdates.old_analyzed_content;
        delete filteredUpdates.analyzed_content;
        
        if (Object.keys(filteredUpdates).length > 0) {
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
    
    // Fetch the complete record
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
  }
}

/**
 * Sync media group captions
 */
export async function syncMediaGroupCaptions(
  supabaseClient: SupabaseClient,
  mediaGroupId: string,
  sourceMessageId: string,
  newCaption: string,
  captionData: any,
  processingState: string,
  correlationId: string
): Promise<void> {
  try {
    // Find all messages in the media group except the source message
    const { success, messages } = await findMessagesByMediaGroupId(
      supabaseClient,
      mediaGroupId,
      correlationId
    );
    
    if (!success || !messages) {
      console.warn(`Could not find messages in media group ${mediaGroupId} to sync captions`);
      return;
    }
    
    // Filter out the source message
    const messagesToUpdate = messages.filter(msg => msg.id !== sourceMessageId);
    
    // Update the captions for all messages in the media group
    for (const message of messagesToUpdate) {
      const { error } = await supabaseClient
        .from("messages")
        .update({
          caption: newCaption,
          caption_data: captionData,
          analyzed_content: captionData,
          processing_state: processingState,
          correlation_id: correlationId
        })
        .eq("id", message.id);
        
      if (error) {
        console.error(`Error updating caption for message ${message.id} in media group ${mediaGroupId}:`, error);
      } else {
        console.log(`Caption synced for message ${message.id} in media group ${mediaGroupId}`);
      }
    }
  } catch (error) {
    console.error(`Exception syncing media group captions for media group ${mediaGroupId}:`, error);
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

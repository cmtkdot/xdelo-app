/**
 * messageUtils.ts
 * 
 * Utility functions for processing Telegram messages.
 * These functions extract common logic from the message handlers
 * to reduce duplication while maintaining the documented workflow.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { TelegramMessage, ForwardInfo } from "../types.ts";
import { MediaProcessor, MediaContent, ProcessingResult as OriginalProcessingResult } from "../../_shared/MediaProcessor.ts";

// Our application's media processing result interface
interface MediaProcessingResult {
  status: 'success' | 'duplicate' | 'error' | 'download_failed_forwarded';
  success: boolean;
  isDuplicate: boolean;
  fileId: string;
  fileUniqueId: string;
  storagePath: string | null;
  publicUrl: string | null;
  mimeType: string | null;
  extension: string | null;
  fileInfo?: {
    fileUniqueId: string;
    storagePath: string | null;
    publicUrl: string | null;
    mimeType: string | null;
    extension: string | null;
    fileSize?: number;
    contentDisposition?: 'inline' | 'attachment';
  };
  error?: string;
  contentDisposition?: 'inline' | 'attachment';
}

// Type adapter function to convert OriginalProcessingResult to our MediaProcessingResult
function adaptProcessingResult(result: OriginalProcessingResult): MediaProcessingResult {
  return {
    status: result.status,
    success: result.status === 'success',
    isDuplicate: result.status === 'duplicate',
    fileId: result.fileId,
    fileUniqueId: result.fileUniqueId,
    storagePath: result.storagePath,
    publicUrl: result.publicUrl,
    mimeType: result.mimeType,
    extension: result.extension,
    contentDisposition: result.contentDisposition,
    error: result.error,
    fileInfo: {
      fileUniqueId: result.fileUniqueId,
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      mimeType: result.mimeType,
      extension: result.extension,
      contentDisposition: result.contentDisposition
    }
  };
}

import { createRetryHandler } from "../../_shared/retryHandler.ts";
import { processCaptionText } from "../../_shared/captionParser.ts";

/**
 * Extract forward information from a Telegram message
 * 
 * @param message - The Telegram message to extract forward info from
 * @returns Forward information or undefined if not forwarded
 * @example
 * const forwardInfo = extractForwardInfo(message);
 * if (forwardInfo) {
 *   console.log(`Message was forwarded from ${forwardInfo.fromName}`);
 * }
 */
export function extractForwardInfo(message: TelegramMessage): ForwardInfo | undefined {
  if (!message) return undefined;
  
  // Check if message is forwarded
  if (!message.forward_date) return undefined;
  
  const forwardInfo: ForwardInfo = {
    date: message.forward_date || message.forward_origin?.date || 0,
    fromChatId: message.forward_from_chat?.id || message.forward_origin?.chat?.id,
    fromChatType: message.forward_from_chat?.type || message.forward_origin?.chat?.type,
    fromMessageId: message.forward_origin?.message_id,
    fromUserId: message.forward_from?.id,
    fromUserIsBot: message.forward_from?.is_bot,
    // Handle different forward types based on available properties
    fromName: message.forward_from?.first_name || message.forward_from?.username,
    // Using any type assertion for properties not in the interface but might exist in the data
    signature: (message as any).forward_signature
  };
  
  return forwardInfo;
}

/**
 * Extract media content from a Telegram message
 * 
 * @param message - The Telegram message to extract media from
 * @returns The media content object or undefined if no media found
 * @example
 * const mediaContent = extractMediaContent(message);
 * if (mediaContent) {
 *   console.log(`Found ${mediaContent.mediaType} with ID ${mediaContent.fileUniqueId}`);
 * }
 */
export function extractMediaContent(message: TelegramMessage): MediaContent | undefined {
  if (!message) return undefined;
  
  // Extract photo (use the largest available)
  if (message.photo && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1];
    return {
      fileUniqueId: photo.file_unique_id,
      fileId: photo.file_id,
      width: photo.width,
      height: photo.height,
      fileSize: photo.file_size,
      mediaType: 'photo'
    };
  }
  
  // Extract video
  if (message.video) {
    return {
      fileUniqueId: message.video.file_unique_id,
      fileId: message.video.file_id,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      mimeType: message.video.mime_type,
      fileSize: message.video.file_size,
      mediaType: 'video'
    };
  }
  
  // Extract document
  if (message.document) {
    return {
      fileUniqueId: message.document.file_unique_id,
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
      mediaType: 'document'
    };
  }
  
  return undefined;
}

/**
 * Process caption text with retry logic
 * 
 * @param captionText - The caption text to process
 * @param correlationId - The correlation ID for request tracking
 * @returns Processed caption data
 * @example
 * const captionData = await processCaptionWithRetry(
 *   message.caption,
 *   correlationId
 * );
 */
export async function processCaptionWithRetry(
  captionText: string | undefined,
  correlationId: string
): Promise<any> {
  if (!captionText) return null;
  
  // Use the centralized RetryHandler instead of the duplicate retryWithBackoff function
  const retryHandler = createRetryHandler({
    maxRetries: 3,
    initialDelayMs: 100,
    backoffFactor: 2.0,
    useJitter: true
  });
  
  const result = await retryHandler.execute(
    async () => await processCaptionText(captionText),
    {
      operationName: 'processCaptionText',
      correlationId,
      supabaseClient: {} as SupabaseClient, // Use a type assertion for a mock client 
      contextData: { captionLength: captionText.length }
    }
  );
  
  if (result.success) {
    return result.result;
  } else {
    throw result.error;
  }
}

/**
 * Check if a message exists in the database
 * 
 * @param supabaseClient - The Supabase client
 * @param telegramMessageId - The Telegram message ID
 * @param chatId - The chat ID
 * @param correlationId - The correlation ID for request tracking
 * @returns Object with exists flag and message data if found
 * @example
 * const { exists, message } = await checkMessageExists(
 *   supabaseClient,
 *   12345,
 *   67890,
 *   correlationId
 * );
 */
export async function checkMessageExists(
  supabaseClient: SupabaseClient,
  telegramMessageId: number,
  chatId: number,
  correlationId: string
): Promise<{ exists: boolean; message?: any }> {
  const functionName = 'checkMessageExists';
  logWithCorrelation(correlationId, `Checking for message ${telegramMessageId} in chat ${chatId}`, 'info', functionName);
  
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId)
      .maybeSingle();
    
    if (error) {
      console.error(`[${correlationId}][${functionName}] Error checking message:`, error.message);
      return { exists: false };
    }
    
    return {
      exists: !!data,
      message: data
    };
  } catch (error) {
    console.error(`[${correlationId}][${functionName}] Exception checking message:`, error);
    return { exists: false };
  }
}

/**
 * Determine if media content has changed between messages
 * 
 * @param oldMedia - The old media content
 * @param newMedia - The new media content
 * @returns Boolean indicating if media has changed
 * @example
 * const hasMediaChanged = hasMediaContentChanged(
 *   oldMediaContent,
 *   newMediaContent
 * );
 */
export function hasMediaContentChanged(
  oldMedia: MediaContent | undefined,
  newMedia: MediaContent | undefined
): boolean {
  // If one has media and the other doesn't, they're different
  if ((!oldMedia && newMedia) || (oldMedia && !newMedia)) {
    return true;
  }
  
  // If neither has media, no change
  if (!oldMedia && !newMedia) {
    return false;
  }
  
  // Compare file unique IDs
  return oldMedia!.fileUniqueId !== newMedia!.fileUniqueId;
}

/**
 * Process media for a message
 * 
 * @param message - The Telegram message
 * @param mediaProcessor - The MediaProcessor instance
 * @param correlationId - The correlation ID for request tracking
 * @returns Processing result
 * @example
 * const result = await processMessageMedia(
 *   message,
 *   mediaProcessor,
 *   correlationId
 * );
 */
export async function processMessageMedia(
  message: TelegramMessage,
  mediaProcessor: MediaProcessor,
  correlationId: string
): Promise<MediaProcessingResult> {
  const functionName = 'processMessageMedia';
  logWithCorrelation(correlationId, `Processing media for message ${message.message_id}`, 'info', functionName);
  
  try {
    // Extract media content
    const mediaContent = extractMediaContent(message);
    if (!mediaContent) {
      return {
        status: 'error',
        success: false, 
        isDuplicate: false,
        fileId: '',
        fileUniqueId: '',
        storagePath: null,
        publicUrl: null,
        mimeType: null,
        extension: null,
        error: "Could not extract media content from message"
      } as MediaProcessingResult;
    }
    
    // Log media type and details for debugging
    logWithCorrelation(correlationId, `Found ${mediaContent.mediaType} with ID ${mediaContent.fileUniqueId}`, 'info', functionName);
    
    // Process the media with retry logic using the centralized RetryHandler
    const retryHandler = createRetryHandler({
      maxRetries: 2,
      initialDelayMs: 500,
      backoffFactor: 2.0,
      useJitter: true
    });
    
    const result = await retryHandler.execute(
      async () => await mediaProcessor.processMedia(mediaContent, correlationId),
      {
        operationName: 'processMedia',
        correlationId,
        supabaseClient: {} as SupabaseClient, // Use type assertion for a mock client
        contextData: { mediaType: mediaContent.mediaType, fileUniqueId: mediaContent.fileUniqueId }
      }
    );
    
    if (result.success && result.result) {
      // Adapt the result to our MediaProcessingResult format
      const adaptedResult = adaptProcessingResult(result.result);
      
      // Add file size from mediaContent if available
      if (adaptedResult.fileInfo && mediaContent.fileSize) {
        adaptedResult.fileInfo.fileSize = mediaContent.fileSize;
      }
      
      return adaptedResult;
    } else {
      return {
        status: 'error',
        success: false,
        isDuplicate: false,
        fileId: mediaContent.fileId,
        fileUniqueId: mediaContent.fileUniqueId,
        storagePath: null,
        publicUrl: null,
        mimeType: mediaContent.mimeType || null,
        extension: null,
        error: result.error || "Media processing failed"
      } as MediaProcessingResult;
    }
  } catch (error) {
    console.error(`[${correlationId}][${functionName}] Exception processing media:`, error);
    return {
      success: false,
      isDuplicate: false,
      error: error instanceof Error ? error.message : String(error)
    } as MediaProcessingResult;
  }
}

/**
 * Create a new message record in the database
 * 
 * @param supabaseClient - The Supabase client
 * @param message - The Telegram message
 * @param mediaResult - The media processing result
 * @param captionData - The processed caption data
 * @param correlationId - The correlation ID for request tracking
 * @returns The created message ID or null if creation failed
 * @example
 * const messageId = await createMessageRecord(
 *   supabaseClient,
 *   message,
 *   mediaResult,
 *   captionData,
 *   correlationId
 * );
 */
export async function createMessageRecord(
  supabaseClient: SupabaseClient,
  message: TelegramMessage,
  mediaResult: MediaProcessingResult,
  captionData: any,
  correlationId: string
): Promise<string | null> {
  const functionName = 'createMessageRecord';
  logWithCorrelation(correlationId, `Creating message record for ${message.message_id}`, 'info', functionName);
  
  try {
    // Extract forward info if present
    const forwardInfo = extractForwardInfo(message);
    
    // Prepare message record
    const messageRecord = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      // user_id field removed as it's no longer used in the database schema
      message_date: new Date(message.date * 1000).toISOString(),
      caption: message.caption,
      caption_data: captionData,
      processing_state: 'completed',
      correlation_id: correlationId,
      forward_info: forwardInfo,
      edit_history: [],
      file_unique_id: mediaResult.fileInfo?.fileUniqueId || '',
      storage_path: mediaResult.fileInfo?.storagePath || null,
      public_url: mediaResult.fileInfo?.publicUrl || null,
      mime_type: mediaResult.fileInfo?.mimeType || null,
      file_size: mediaResult.fileInfo?.fileSize || null,
      content_disposition: mediaResult.fileInfo?.contentDisposition || null,
    };
    
    // Insert record
    const { data, error } = await supabaseClient
      .from('messages')
      .insert(messageRecord)
      .select('id')
      .single();
    
    if (error) {
      logWithCorrelation(correlationId, `Error creating message: ${error.message}`, 'error', functionName);
      return null;
    }
    
    logWithCorrelation(correlationId, `Created message with ID: ${data.id}`, 'info', functionName);
    return data.id;
  } catch (error) {
    logWithCorrelation(correlationId, `Exception creating message: ${error instanceof Error ? error.message : String(error)}`, 'error', functionName);
    return null;
  }
}

/**
 * Update an existing message record in the database
 * 
 * @param supabaseClient - The Supabase client
 * @param existingMessage - The existing message record
 * @param message - The updated Telegram message
 * @param mediaResult - The media processing result (if media changed)
 * @param captionData - The processed caption data
 * @param correlationId - The correlation ID for request tracking
 * @returns Boolean indicating if update was successful
 * @example
 * const success = await updateMessageRecord(
 *   supabaseClient,
 *   existingMessage,
 *   message,
 *   mediaResult,
 *   captionData,
 *   correlationId
 * );
 */
export async function updateMessageRecord(
  supabaseClient: SupabaseClient,
  existingMessage: any,
  message: TelegramMessage,
  mediaResult: MediaProcessingResult | null,
  captionData: any,
  correlationId: string
): Promise<boolean> {
  const functionName = 'updateMessageRecord';
  logWithCorrelation(correlationId, `Updating message record ${existingMessage.id}`, 'info', functionName);
  
  try {
    // Create edit history entry
    const editHistoryEntry = {
      edit_date: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      previous_caption_data: existingMessage.caption_data,
      previous_storage_path: existingMessage.storage_path,
      previous_public_url: existingMessage.public_url,
      previous_mime_type: existingMessage.mime_type,
      previous_file_size: existingMessage.file_size,
      correlation_id: correlationId
    };
    
    // Prepare update data
    const updateData: Record<string, any> = {
      caption: message.caption,
      caption_data: captionData,
      // Ensure both caption_data and analyzed_content are kept in sync
      analyzed_content: captionData,
      processing_state: 'completed',
      correlation_id: correlationId,
      edit_history: [...(existingMessage.edit_history || []), editHistoryEntry],
      last_edited_at: new Date().toISOString()
    };
    
    // If media changed, update media fields
    if (mediaResult && mediaResult.success && mediaResult.fileInfo) {
      if (mediaResult.fileInfo.storagePath) {
        updateData.file_unique_id = mediaResult.fileInfo.storagePath.split('.')[0];
        updateData.storage_path = mediaResult.fileInfo.storagePath;
      }
      updateData.public_url = mediaResult.fileInfo.publicUrl;
      updateData.mime_type = mediaResult.fileInfo.mimeType;
      updateData.file_size = mediaResult.fileInfo.fileSize;
      updateData.content_disposition = mediaResult.fileInfo.contentDisposition;
    }
    
    // Update record
    const { error } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('id', existingMessage.id);
    
    if (error) {
      logWithCorrelation(correlationId, `Error updating message: ${error.message}`, 'error', functionName);
      return false;
    }
    
    logWithCorrelation(correlationId, `Updated message ${existingMessage.id}`, 'info', functionName);
    return true;
  } catch (error) {
    logWithCorrelation(correlationId, `Exception updating message: ${error instanceof Error ? error.message : String(error)}`, 'error', functionName);
    return false;
  }
}

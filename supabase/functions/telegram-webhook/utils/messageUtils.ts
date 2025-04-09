/**
 * messageUtils.ts
 * 
 * Utility functions for processing Telegram messages.
 * These functions extract common logic from the message handlers
 * to reduce duplication while maintaining the documented workflow.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { TelegramMessage, ForwardInfo } from "../types.ts";
import { MediaProcessor, MediaContent, ProcessingResult } from "../../_shared/MediaProcessor.ts";
import { retryWithBackoff } from "./errorUtils.ts";
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
    date: message.forward_date,
    fromChatId: message.forward_from_chat?.id,
    fromChatType: message.forward_from_chat?.type,
    fromMessageId: message.forward_from_message_id,
    fromName: message.forward_sender_name,
    fromUserId: message.forward_from?.id,
    fromUserIsBot: message.forward_from?.is_bot,
    signature: message.forward_signature
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
  
  return await retryWithBackoff(
    async () => await processCaptionText(captionText),
    {
      maxRetries: 3,
      initialDelayMs: 100,
      functionName: 'processCaptionText',
      correlationId
    }
  );
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
  console.log(`[${correlationId}][${functionName}] Checking for message ${telegramMessageId} in chat ${chatId}`);
  
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
): Promise<ProcessingResult> {
  const functionName = 'processMessageMedia';
  console.log(`[${correlationId}][${functionName}] Processing media for message ${message.message_id}`);
  
  try {
    // Extract media content
    const mediaContent = extractMediaContent(message);
    if (!mediaContent) {
      return {
        success: false,
        isDuplicate: false,
        error: 'No media content found in message'
      };
    }
    
    // Process the media with retry logic
    return await retryWithBackoff(
      async () => await mediaProcessor.processMedia(mediaContent, correlationId),
      {
        maxRetries: 2,
        initialDelayMs: 500,
        functionName: 'processMedia',
        correlationId
      }
    );
  } catch (error) {
    console.error(`[${correlationId}][${functionName}] Exception processing media:`, error);
    return {
      success: false,
      isDuplicate: false,
      error: error instanceof Error ? error.message : String(error)
    };
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
  mediaResult: ProcessingResult,
  captionData: any,
  correlationId: string
): Promise<string | null> {
  const functionName = 'createMessageRecord';
  console.log(`[${correlationId}][${functionName}] Creating message record for ${message.message_id}`);
  
  try {
    // Extract forward info if present
    const forwardInfo = extractForwardInfo(message);
    
    // Prepare message record
    const messageRecord = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      user_id: message.from?.id,
      message_date: new Date(message.date * 1000).toISOString(),
      caption: message.caption,
      caption_data: captionData,
      processing_state: 'completed',
      correlation_id: correlationId,
      forward_info: forwardInfo,
      edit_history: [],
      file_unique_id: mediaResult.fileInfo?.storagePath.split('.')[0],
      storage_path: mediaResult.fileInfo?.storagePath,
      public_url: mediaResult.fileInfo?.publicUrl,
      mime_type: mediaResult.fileInfo?.mimeType,
      file_size: mediaResult.fileInfo?.fileSize,
      content_disposition: mediaResult.fileInfo?.contentDisposition
    };
    
    // Insert record
    const { data, error } = await supabaseClient
      .from('messages')
      .insert(messageRecord)
      .select('id')
      .single();
    
    if (error) {
      console.error(`[${correlationId}][${functionName}] Error creating message:`, error.message);
      return null;
    }
    
    console.log(`[${correlationId}][${functionName}] Created message with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`[${correlationId}][${functionName}] Exception creating message:`, error);
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
  mediaResult: ProcessingResult | null,
  captionData: any,
  correlationId: string
): Promise<boolean> {
  const functionName = 'updateMessageRecord';
  console.log(`[${correlationId}][${functionName}] Updating message record ${existingMessage.id}`);
  
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
      processing_state: 'completed',
      correlation_id: correlationId,
      edit_history: [...(existingMessage.edit_history || []), editHistoryEntry],
      last_edited_at: new Date().toISOString()
    };
    
    // If media changed, update media fields
    if (mediaResult && mediaResult.success && mediaResult.fileInfo) {
      updateData.file_unique_id = mediaResult.fileInfo.storagePath.split('.')[0];
      updateData.storage_path = mediaResult.fileInfo.storagePath;
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
      console.error(`[${correlationId}][${functionName}] Error updating message:`, error.message);
      return false;
    }
    
    console.log(`[${correlationId}][${functionName}] Updated message ${existingMessage.id}`);
    return true;
  } catch (error) {
    console.error(`[${correlationId}][${functionName}] Exception updating message:`, error);
    return false;
  }
}

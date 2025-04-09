/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts"; 
import { logAuditEvent } from "../../_shared/dbUtils.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
// Local Imports
import {
    ForwardInfo, // Keep for insert/update
    MessageContext,
    TelegramMessage,
} from '../types.ts';
<<<<<<< HEAD
import { createMessage, checkDuplicateMessage, xdelo_logProcessingEvent } from '../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../_shared/messageUtils.ts';

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

/**
 * Main handler for media messages from Telegram
 * 
 * @param message - The Telegram message object containing media
 * @param context - Context information about the message
 * @returns Response object to send back to Telegram
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;
    
    // Log the start of processing
    logger?.info(`Processing ${isEdit ? 'edited' : 'new'} media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    
    // Validate token
    if (!TELEGRAM_BOT_TOKEN) {
      const errorMsg = 'Missing TELEGRAM_BOT_TOKEN environment variable';
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id
        },
        errorMsg
      );
      return new Response(
        JSON.stringify({ error: errorMsg, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Basic validation
    if (!message || !message.chat || !message.message_id) {
      const errorMsg = 'Invalid message structure: Missing chat or message_id';
      await xdelo_logProcessingEvent(
        "media_processing_error",
        "unknown",
        correlationId,
        { error: errorMsg },
        errorMsg
      );
      throw new Error(errorMsg);
    }
    
    let response;
    
    // Route to the appropriate handler based on whether it's an edit
    if (isEdit && previousMessage) {
      response = await xdelo_handleEditedMediaMessage(message, context, previousMessage);
    } else {
      response = await xdelo_handleNewMediaMessage(message, context);
    }
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger?.error(`Error processing media message: ${errorMessage}`, {
      error: error instanceof Error ? error : { message: errorMessage },
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    // Also log to database for tracking
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: errorMessage
        },
        errorMessage
      );
    } catch (logError) {
      context.logger?.error(`Failed to log error to database: ${
        logError instanceof Error ? logError.message : String(logError)}`);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Helper function to handle edited media messages
 */
async function xdelo_handleEditedMediaMessage(
  message: TelegramMessage, 
  context: MessageContext,
  previousMessage: TelegramMessage
): Promise<Response> {
  const { correlationId, logger } = context;

  // First, look up the existing message
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (lookupError) {
    logger?.error(`Failed to lookup existing message for edit: ${lookupError.message}`);
    await xdelo_logProcessingEvent(
      "message_lookup_failed",
      message.message_id.toString(),
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id
      },
      lookupError.message
    );
    throw new Error(`Database lookup failed: ${lookupError.message}`);
  }

  if (existingMessage) {
    // Store previous state in edit_history
    let editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      previous_processing_state: existingMessage.processing_state,
      edit_source: 'telegram_edit',
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
    });

    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = message.photo || message.video || message.document;
    
    // If media has been updated, handle the new media
    if (hasNewMedia) {
      try {
        logger?.info(`Media has changed in edit for message ${message.message_id}`);
        
        // Determine the current file details
        const telegramFile = message.photo ? 
          message.photo[message.photo.length - 1] : 
          message.video || message.document;
          
        if (!telegramFile || !telegramFile.file_id || !telegramFile.file_unique_id) {
          throw new Error('Missing file information in edited message');
        }
          
        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);
        
        // Process the new media file
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN,
          existingMessage.id // Use existing message ID
        );
        
        if (!mediaProcessResult.success) {
          throw new Error(`Failed to process edited media: ${mediaProcessResult.error}`);
        }
        
        // If successful, update the message with new media info
        const { data: updateResult, error: updateError } = await supabaseClient
          .from('messages')
          .update({
            caption: message.caption,
            file_id: telegramFile.file_id,
            file_unique_id: telegramFile.file_unique_id,
            mime_type: detectedMimeType,
            width: telegramFile.width,
            height: telegramFile.height,
            duration: message.video?.duration,
            file_size: telegramFile.file_size,
            edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
            edit_count: (existingMessage.edit_count || 0) + 1,
            edit_history: editHistory,
            processing_state: message.caption ? 'pending' : existingMessage.processing_state,
            storage_path: mediaProcessResult.fileInfo.storage_path,
            public_url: mediaProcessResult.fileInfo.public_url,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);
          
        if (updateError) {
          throw new Error(`Failed to update message with new media: ${updateError.message}`);
        }
        
        // Log the edit operation
        await xdelo_logProcessingEvent(
          "message_media_edited",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            file_id: telegramFile.file_id,
            file_unique_id: telegramFile.file_unique_id,
            storage_path: mediaProcessResult.fileInfo.storage_path
          }
        );
      } catch (mediaError) {
        logger?.error(`Error processing edited media: ${mediaError instanceof Error ? mediaError.message : String(mediaError)}`);
        await xdelo_logProcessingEvent(
          "media_edit_error",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          },
          mediaError instanceof Error ? mediaError.message : String(mediaError)
        );
        throw mediaError;
      }
    } 
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      logger?.info(`Caption has changed in edit for message ${message.message_id}`);
      
      // Update just the caption
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        await xdelo_logProcessingEvent(
          "caption_update_error",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          },
          updateError.message
        );
        throw new Error(`Failed to update message caption: ${updateError.message}`);
      }
      
      // Log the caption edit
      await xdelo_logProcessingEvent(
        "message_caption_edited",
        existingMessage.id,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          previous_caption: existingMessage.caption,
          new_caption: message.caption
        }
      );
    } else {
      // No significant changes detected
      logger?.info(`No significant changes detected in edit for message ${message.message_id}`);
      
      // Still update the edit metadata
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        logger?.warn(`Failed to update edit metadata: ${updateError.message}`);
      }
      
      // Log the edit operation anyway
      await xdelo_logProcessingEvent(
        "message_edit_received",
        existingMessage.id,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          no_changes: true
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If existing message not found, handle as new message
  logger?.info(`Original message not found, creating new message for edit ${message.message_id}`);
  await xdelo_logProcessingEvent(
    "edit_for_nonexistent_message",
    message.message_id.toString(),
    correlationId,
    {
      message_id: message.message_id,
      chat_id: message.chat.id
    }
  );
  return await xdelo_handleNewMediaMessage(message, context);
}

/**
 * Helper function to handle new media messages
 */
async function xdelo_handleNewMediaMessage(
=======
import {
    xdelo_detectMimeType,
    xdelo_downloadMediaFromTelegram, // Will remove token param later
    xdelo_getStoragePath,
    xdelo_isViewableMimeType,
    xdelo_uploadMediaToStorage // Will remove supabase param later
} from '../utils/mediaUtils.ts';
import { constructTelegramMessageUrl } from '../utils/messageUtils.ts';

/**
 * Handles *new* media messages (photo, video, document) from Telegram.
 * Checks for duplicates based on file_unique_id.
 * If new: Downloads the media, uploads it to storage (if not already present),
 *   and inserts a new record into the 'messages' table.
 * If duplicate: Checks for caption changes, updates existing record accordingly,
 *   and sets state for potential reprocessing if caption changed.
 * Assumes *edited* messages (distinct edits on existing messages) are routed elsewhere.
 */
export async function handleMediaMessage(
  telegramToken: string, // Keep for download util for now
>>>>>>> 1c6afd6248d76680bdcec70142d877d46e874c8a
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  // isEdit is ignored here, this handler only deals with new messages or duplicates
  const { correlationId } = context; 
  const functionName = 'handleMediaMessage';
  let dbMessageId: string | null = null; 
  let operation: 'inserted' | 'updated' | 'skipped_duplicate' = 'skipped_duplicate'; // Default

  try {
<<<<<<< HEAD
    // Check for existing message in database
    const { data: existingMessages, error: checkError } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .limit(1);
    
    const isDuplicate = !checkError && existingMessages && existingMessages.length > 0;
    
    if (isDuplicate) {
      logger?.info(`Duplicate message detected: ${message.message_id} in chat ${message.chat.id}`);
      
      // Log the duplicate detection
      await xdelo_logProcessingEvent(
        "duplicate_message_detected",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_group_id: message.media_group_id
        }
      );
      
      return new Response(
        JSON.stringify({ success: true, duplicate: true, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the media message
    const messageUrl = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    logger?.info(`Processing new media message: ${message.message_id}`, {
      chat_id: message.chat.id,
      message_url: messageUrl
    });
    
    // Prepare the message data
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    if (!telegramFile || !telegramFile.file_id || !telegramFile.file_unique_id) {
      throw new Error('Missing file information in message');
    }
    
    // Process media
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );
    
    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
=======
    console.log(`[${correlationId}][${functionName}] Processing media message ${message.message_id} in chat ${message.chat?.id}`);

    // --- Basic Validation ---
    if (!message || !message.chat || !message.message_id) {
      throw new Error(`Invalid message structure: Missing chat or message_id`);
    }

    // --- Extract Media Info ---
    const photo = message.photo ? message.photo[message.photo.length - 1] : undefined;
    const video = message.video;
    const document = message.document;
    const mediaContent = photo || video || document;

    if (!mediaContent || !mediaContent.file_unique_id || !mediaContent.file_id) {
      await logAuditEvent("media_info_missing", null, correlationId, { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id }, "Missing media content or essential file IDs (file_unique_id, file_id)");
      throw new Error(`Missing media content or essential file IDs`);
>>>>>>> 1c6afd6248d76680bdcec70142d877d46e874c8a
    }
    const fileUniqueId = mediaContent.file_unique_id;
    const fileId = mediaContent.file_id; // Current file_id (might differ slightly from original if duplicate)
    const detectedMimeType = xdelo_detectMimeType(message);

    // --- Check for Existing DB Record using file_unique_id ---
    console.log(`[${correlationId}][${functionName}] Checking DB for existing message with file_unique_id: ${fileUniqueId}`);
    const { data: existingRecord, error: findError } = await supabaseClient
        .from('messages')
        .select('*, message_content:text_content') // Select all for potential update comparison, alias text_content
        .eq('file_unique_id', fileUniqueId)
        .maybeSingle();

    if (findError) {
        console.error(`[${correlationId}][${functionName}] Error finding existing message by file_unique_id:`, findError);
        await logAuditEvent("db_find_existing_failed", null, correlationId, { function: functionName, file_unique_id: fileUniqueId }, findError.message);
        throw new Error(`Database error checking for existing message: ${findError.message}`);
    }

    // --- Prepare Common Data ---
    const messageUrl = constructTelegramMessageUrl(message);
    const forwardInfo: ForwardInfo | undefined = message.forward_origin ? {
<<<<<<< HEAD
      is_forwarded: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_chat_type: message.forward_origin.chat?.type,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
      original_chat_id: message.forward_origin.chat?.id,
      original_chat_title: message.forward_origin.chat?.title,
      original_message_id: message.forward_origin.message_id
    } : undefined;
    
    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: mediaResult.fileInfo.mime_type,
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size || mediaResult.fileInfo.file_size,
      correlation_id: correlationId,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
      is_forward: !!forwardInfo,
      edit_history: context.isEdit ? [{
        timestamp: new Date().toISOString(),
        is_initial_edit: true,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      }] : [],
      storage_exists: true,
      storage_path_standardized: true,
      message_url: messageUrl
    };
    
    // Create the message
    const result = await createMessage(supabaseClient, messageInput, logger);
    
    if (!result.success) {
      logger?.error(`Failed to create message: ${result.error_message}`, {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      
      // Also try to log to the database
      await xdelo_logProcessingEvent(
        "message_creation_failed",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: result.error_message
        },
        result.error_message
      );
      
      throw new Error(result.error_message || 'Failed to create message record');
    }
    
    // Log the success
    logger?.success(`Successfully created new media message: ${result.id}`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      storage_path: mediaResult.fileInfo.storage_path
    });
    
    // Log to audit log
    await xdelo_logProcessingEvent(
      "message_created",
      result.id || message.message_id.toString(),
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        storage_path: mediaResult.fileInfo.storage_path,
        has_caption: !!message.caption
      }
    );
    
    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
=======
        is_forwarded: true, forward_origin_type: message.forward_origin.type, forward_from_chat_id: message.forward_origin.sender_chat?.id, forward_from_chat_title: message.forward_origin.sender_chat?.title, forward_from_chat_type: message.forward_origin.sender_chat?.type, forward_from_message_id: message.forward_origin.message_id, forward_date: new Date(message.forward_origin.date * 1000).toISOString(), original_chat_id: message.forward_origin.sender_chat?.id, original_chat_title: message.forward_origin.sender_chat?.title, original_message_id: message.forward_origin.message_id
      } : (existingRecord?.forward_info || undefined); // Use existing if available and not overwritten
    const messageType = photo ? 'photo' : video ? 'video' : document ? 'document' : 'unknown';

    // --- Process Existing Record (Duplicate Found) ---
    if (existingRecord) {
        dbMessageId = existingRecord.id;
        operation = 'updated'; // Treat as an update even if only metadata changes
        console.log(`[${correlationId}][${functionName}] Found existing DB record ${dbMessageId} for file_unique_id ${fileUniqueId}. Processing as duplicate/update.`);

        const existingCaption = existingRecord.caption;
        const incomingCaption = message.caption || null;
        const captionChanged = existingCaption !== incomingCaption;
        
        // Prepare base update data (always update these)
        let updateData: Record<string, any> = {
            telegram_message_id: message.message_id, // Update to latest message ID instance
            chat_id: message.chat.id, // Update chat context
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            user_id: message.from?.id?.toString(),
            telegram_data: message, // Update raw data
            message_url: messageUrl,
            forward_info: forwardInfo, // Update forward info
            updated_at: new Date().toISOString(),
            correlation_id: correlationId,
            // Use the latest file_id received from Telegram
            file_id: fileId,
             // Reset error state on successful receipt of a duplicate?
            error_message: null, 
            last_error_at: null,
            // Ensure text_content remains null for media messages
            text_content: null,
        };

        if (captionChanged) {
            console.log(`[${correlationId}][${functionName}] Caption changed for duplicate message ${dbMessageId}. Updating caption and history.`);
            
            // Add edit history entry for caption change
            const currentEditHistory = existingRecord.edit_history || [];
            const previousStateEntry = {
                timestamp: new Date().toISOString(),
                previous_caption: existingCaption,
                previous_analyzed_content: existingRecord.analyzed_content,
                // Use current timestamp as edit_date if message doesn't have one
                edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(), 
            };

            updateData = {
                ...updateData,
                caption: incomingCaption,
                edit_history: [...currentEditHistory, previousStateEntry],
                edit_count: (existingRecord.edit_count || 0) + 1,
                // Set state to indicate caption needs reprocessing
                processing_state: 'pending_caption_update',
                // Update related caption fields
                is_original_caption: false, // It's now based on an update
                message_caption_id: null, // Reset if caption changes
                group_caption_synced: false,
            };
             await logAuditEvent("media_message_duplicate_caption_changed", dbMessageId, correlationId, { function: functionName, file_unique_id: fileUniqueId }, "Caption changed on duplicate message.");
        } else {
            console.log(`[${correlationId}][${functionName}] Caption unchanged for duplicate message ${dbMessageId}. Updating metadata only.`);
            // If caption didn't change, ensure processing state isn't pending unless it already was
            updateData.processing_state = existingRecord.processing_state === 'pending_caption' || existingRecord.processing_state === 'pending_caption_update' 
                                            ? existingRecord.processing_state 
                                            : 'processed';
             await logAuditEvent("media_message_duplicate_caption_same", dbMessageId, correlationId, { function: functionName, file_unique_id: fileUniqueId }, "Caption same on duplicate message.");                               
        }

        // Perform DB Update
        const { error: updateError } = await supabaseClient
            .from('messages')
            .update(updateData)
            .eq('id', dbMessageId);

        if (updateError) {
            console.error(`[${correlationId}][${functionName}] Error updating duplicate media message ${dbMessageId}:`, updateError);
            await logAuditEvent("message_update_failed", dbMessageId, correlationId, { function: functionName, update_type: 'duplicate_media', table: 'messages' }, updateError.message);
            throw new Error(`Failed to update duplicate media message: ${updateError.message}`);
        }
        console.log(`[${correlationId}][${functionName}] Successfully updated DB record ID: ${dbMessageId} for duplicate.`);

    } 
    // --- Process New Record (No Duplicate Found in DB) ---
    else {
        operation = 'inserted';
        console.log(`[${correlationId}][${functionName}] No existing DB record found for file_unique_id ${fileUniqueId}. Processing as NEW insert.`);

        // --- Download Media --- 
        console.log(`[${correlationId}][${functionName}] Downloading media file_id: ${fileId}`);
        const downloadResult = await xdelo_downloadMediaFromTelegram(fileId, fileUniqueId, detectedMimeType, telegramToken);
        if (!downloadResult.success || !downloadResult.blob) {
            await logAuditEvent("media_download_failed", null, correlationId, { function: functionName, telegram_file_id: fileId, telegram_file_unique_id: fileUniqueId, chat_id: message.chat.id, telegram_message_id: message.message_id }, downloadResult.error ?? "Download failed");
            throw new Error(`Failed to download media: ${downloadResult.error}`);
        }
        const downloadedBlob = downloadResult.blob;
        const mimeTypeFromDownload = downloadResult.mimeType;
        const finalMimeType = (mimeTypeFromDownload && mimeTypeFromDownload !== 'application/octet-stream') 
                               ? mimeTypeFromDownload : detectedMimeType;
        const standardizedStoragePath = xdelo_getStoragePath(fileUniqueId, finalMimeType);
        const contentDispositionToUse = xdelo_isViewableMimeType(finalMimeType) ? 'inline' : 'attachment';

        // --- Check Storage Existence (Avoid redundant uploads) ---
        console.log(`[${correlationId}][${functionName}] Checking storage for existing object at path: ${standardizedStoragePath}`);
        let storageObjectExists = false;
        let existingPublicUrl: string | undefined = undefined;
        try {
            const { data: listData, error: listError } = await supabaseClient.storage 
                .from('telegram-media').list('', { limit: 1, offset: 0, search: standardizedStoragePath });
            if (listError) {
                console.error(`[${correlationId}][${functionName}] Error listing storage objects:`, listError);
                await logAuditEvent("storage_check_failed", null, correlationId, { function: functionName, storage_path: standardizedStoragePath }, listError.message);
                throw new Error(`Storage check failed: ${listError.message}`);
            }
            if (listData && listData.length > 0 && listData[0].name === standardizedStoragePath) {
                storageObjectExists = true;
                console.log(`[${correlationId}][${functionName}] Storage object found (likely from previous attempt or different message).`);
                const { data: urlData } = supabaseClient.storage.from('telegram-media').getPublicUrl(standardizedStoragePath);
                existingPublicUrl = urlData?.publicUrl;
            } else {
                console.log(`[${correlationId}][${functionName}] Storage object not found.`);
            }
        } catch (storageCheckError) {
            const errorMsg = storageCheckError instanceof Error ? storageCheckError.message : String(storageCheckError);
            console.error(`[${correlationId}][${functionName}] Exception during storage check:`, errorMsg);
            await logAuditEvent("storage_check_exception", null, correlationId, { function: functionName, storage_path: standardizedStoragePath }, errorMsg);
            throw new Error(`Storage check exception: ${errorMsg}`);
        }

        // --- Upload Media (if needed) ---
        let publicUrlToUse: string | undefined = existingPublicUrl;
        let uploadPerformed = false;
        if (!storageObjectExists) {
            console.log(`[${correlationId}][${functionName}] Storage object did not exist. Uploading downloaded media to: ${standardizedStoragePath}`);
            const uploadResult = await xdelo_uploadMediaToStorage(supabaseClient, standardizedStoragePath, downloadedBlob, finalMimeType);
            if (!uploadResult.success || !uploadResult.publicUrl) {
                await logAuditEvent("media_upload_failed", null, correlationId, { function: functionName, storage_path: standardizedStoragePath }, uploadResult.error ?? "Upload failed");
                throw new Error(`Failed to upload media for new message: ${uploadResult.error}`);
            }
            publicUrlToUse = uploadResult.publicUrl;
            uploadPerformed = true;
            console.log(`[${correlationId}][${functionName}] Media uploaded successfully. Public URL: ${publicUrlToUse}`);
        } else {
            console.log(`[${correlationId}][${functionName}] Skipping upload. Using existing public URL: ${publicUrlToUse}`);
        }
        
        if (!publicUrlToUse) {
             const errorMsg = "Failed to obtain a public URL for the media.";
             console.error(`[${correlationId}][${functionName}] ${errorMsg}`);
             await logAuditEvent("public_url_missing", null, correlationId, { function: functionName, storage_path: standardizedStoragePath }, errorMsg);
             throw new Error(errorMsg);
        }

        // --- Prepare Insert Data ---
        const insertData = {
            telegram_message_id: message.message_id,
            chat_id: message.chat.id, chat_type: message.chat.type, chat_title: message.chat.title,
            user_id: message.from?.id?.toString(),
            message_type: messageType, 
            caption: message.caption,
            text_content: null, // Ensure text is null
            telegram_data: message,
            media_group_id: message.media_group_id,
            file_id: fileId,
            file_unique_id: fileUniqueId,
            mime_type: finalMimeType,
            mime_type_original: document?.mime_type || video?.mime_type, 
            mime_type_verified: true, 
            file_size: mediaContent.file_size || downloadedBlob.size,
            width: photo?.width || video?.width, height: photo?.height || video?.height, duration: video?.duration,
            storage_path: standardizedStoragePath,
            public_url: publicUrlToUse,
            message_url: messageUrl,
            content_disposition: contentDispositionToUse,
            storage_exists: true, 
            storage_path_standardized: true,
            needs_redownload: false,
            processing_state: message.caption ? 'pending_caption' : 'processed' as const, 
            analyzed_content: null, old_analyzed_content: null,
            error_message: null, retry_count: 0, last_error_at: null,
            edit_history: null, edit_count: 0,
            is_edited_channel_post: false, edit_date: null,
            forward_info: forwardInfo,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            correlation_id: correlationId,
            message_caption_id: null, is_original_caption: !!message.caption, group_caption_synced: false,
        };

        // --- Perform Insert ---
        console.log(`[${correlationId}][${functionName}] Performing insert for new media message.`);
        const { data: insertedData, error: insertError } = await supabaseClient
            .from('messages').insert(insertData).select('id').single();

        if (insertError || !insertedData || !insertedData.id) {
            await logAuditEvent("message_insert_failed", null, correlationId, { function: functionName, table: 'messages' }, insertError?.message || 'Insert failed');
            console.error(`[${correlationId}][${functionName}] Error inserting message:`, insertError);
            throw new Error(`Database error inserting message: ${insertError?.message || 'No ID returned'}`);
        }
        dbMessageId = insertedData.id;
        console.log(`[${correlationId}][${functionName}] Successfully inserted message ID: ${dbMessageId}`);

        // --- Log Success Audit for Insert ---
        await logAuditEvent("media_message_created", dbMessageId, correlationId,
            {
                function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id,
                file_unique_id: fileUniqueId, media_type: messageType, media_group_id: message.media_group_id,
                has_caption: !!message.caption, is_forward: !!forwardInfo, upload_performed: uploadPerformed
            }, null
        );
    }

    // --- Return Success Response ---
    console.log(`[${correlationId}][${functionName}] Completed processing media message ${message.message_id}. Operation: ${operation}`);
    return createCorsResponse(
      { success: true, messageId: dbMessageId, operation: operation, correlationId: correlationId }, 
      { status: 200 }
    );

  } catch (error) {
    // --- Centralized Error Handling ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[${correlationId}][${functionName}] Unhandled error:`, errorMessage);
    if (errorStack) console.error(`[${correlationId}][${functionName}] Stack (truncated):`, errorStack?.substring(0, 500));

    await logAuditEvent("message_processing_failed", dbMessageId, correlationId,
        { handler_type: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id, error_stack_preview: errorStack?.substring(0, 200) }, errorMessage
    );
    return createCorsResponse(
      { success: false, error: `Failed in ${functionName}: ${errorMessage}`, correlationId: correlationId }, 
      { status: 200 }
>>>>>>> 1c6afd6248d76680bdcec70142d877d46e874c8a
    );
  }
}
<<<<<<< HEAD
=======

// Note: Caption processing triggers (like xdelo_processCaptionChanges) are NOT called directly.
// Instead, the 'processing_state' is set to 'pending_caption_update' when a caption changes on a duplicate.
// Another system (e.g., DB trigger, separate function) should monitor this state.
>>>>>>> 1c6afd6248d76680bdcec70142d877d46e874c8a

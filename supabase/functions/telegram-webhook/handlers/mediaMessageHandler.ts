/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />
// Shared Imports
// Assuming createMediaProcessor is correctly imported from its actual location
import { createMediaProcessor } from "../../_shared/mediaUtils.ts";
import { supabaseClient } from "../../_shared/supabaseClient.ts"; // Assuming this provides a SupabaseClient instance
// Error handling
import { createTelegramErrorResponse } from "../utils/errorUtils.ts";
import { extractForwardInfo, findMessageByFileUniqueId, logProcessingEvent, triggerCaptionParsing, updateMessageRecord, upsertMediaMessageRecord// Assuming this is correctly typed
 } from '../utils/dbOperations.ts';
import { logWithCorrelation } from '../utils/logger.ts';
import { checkMessageExists, extractMediaContent, processCaptionWithRetry// Assuming this returns processed caption data or null
 } from '../utils/messageUtils.ts';
// Placeholder for handleError if it's defined elsewhere and needed
// declare function handleError(error: any, context: any): Promise<any>; // Removed placeholder
// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  logWithCorrelation('system', 'CRITICAL: Missing TELEGRAM_BOT_TOKEN environment variable. Function cannot proceed.', 'ERROR', 'mediaMessageHandler');
  throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
}
/**
 * Determines if a media processing error is likely non-retriable.
 * These errors typically indicate issues with the file itself or Telegram's access to it,
 * making retries unlikely to succeed.
 * @param error - The error object or message from media processing.
 * @returns True if the error suggests skipping retries, false otherwise.
 */ function isNonRetriableMediaError(error) {
  if (!error) return false;
  // Standardize error message to lower case for consistent checking
  const errorMessage = (typeof error === 'string' ? error : error.message || '').toLowerCase();
  // List of keywords indicating non-retriable errors
  const nonRetriableKeywords = [
    'file too large',
    'unsupported format',
    'unsupported mime type',
    'telegram file expired',
    'file not found',
    'download failed: 400 bad request',
    'invalid file id',
    'file reference expired',
    'file_id doesn\'t match',
    'bot can\'t access',
    'file is no longer available'
  ];
  // Check if the error message contains any of the keywords
  return nonRetriableKeywords.some((keyword)=>errorMessage.includes(keyword));
// Additionally, you could check for specific error codes if your mediaProcessor provides them:
// if (error.code === 'TELEGRAM_FILE_TOO_BIG') return true;
// if (error.code === 'UNSUPPORTED_MEDIA_TYPE') return true;
// return false; // Default to retriable if no specific condition matches
}
/**
 * Map a media processing status string to a database processing state enum value.
 * @param status - The status string from media processing (e.g., 'success', 'error', 'duplicate').
 * @returns The corresponding database processing state string (e.g., 'completed', 'error', 'pending_analysis').
 */ function mapStatusToProcessingState(status) {
  switch(status){
    case 'success':
      return 'completed';
    case 'duplicate':
      return 'completed'; // Treat duplicate as completed in terms of state
    case 'error':
      // Default 'error' state, might be overridden later if non-retriable
      return 'error';
    // Note: 'skipped_media_error' is set explicitly later, not mapped directly here
    default:
      // If status is unknown or indicates pending work
      return 'pending_analysis';
  }
}
/**
 * Create a standardized error response using the utility function.
 * @param error - The error object or message.
 * @param functionName - Name of the function where the error occurred.
 * @param status - HTTP status code (default 500).
 * @param correlationId - Correlation ID for tracing.
 * @param metadata - Additional metadata object.
 * @returns A Response object.
 */ function createErrorResponse(error, functionName, status = 500, correlationId, metadata) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // Uses the imported createTelegramErrorResponse utility
  return createTelegramErrorResponse(errorMessage, functionName, status, correlationId, metadata);
}
/**
 * Unified handler for both new and edited media messages.
 * This function acts as the main entry point for media messages, routing them
 * to specific handlers based on whether they are new or edits.
 *
 * @param telegramBotToken - The Telegram Bot Token.
 * @param message - The Telegram message object.
 * @param context - Processing context including correlationId, isRecoveredEdit flag, and potentially waitUntil.
 * @returns A Promise resolving to a Response object with the processing result.
 */ export async function handleMediaMessage(telegramBotToken, message, context) {
  const { correlationId, isRecoveredEdit } = context;
  const functionName = 'handleMediaMessage'; // For logging context
  // Log start of processing, indicating if it's a recovered edit
  if (isRecoveredEdit) {
    logWithCorrelation(correlationId, `Processing recovered edit as new media message ${message.message_id} in chat ${message.chat?.id}`, 'INFO', functionName);
  } else {
    logWithCorrelation(correlationId, `Processing message ${message.message_id} in chat ${message.chat?.id}`, 'INFO', functionName);
  }
  try {
    // Basic validation: Ensure bot token is present
    if (!telegramBotToken) {
      logWithCorrelation(correlationId, "CRITICAL: TELEGRAM_BOT_TOKEN is missing in handleMediaMessage.", 'ERROR', functionName);
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set");
    }
    // Basic validation: Ensure message object is present
    if (!message) {
      logWithCorrelation(correlationId, "Received null or undefined message object.", 'ERROR', functionName);
      return createTelegramErrorResponse("Invalid message object received", functionName, 400, correlationId, {});
    }
    if (!message.message_id || !message.chat?.id) {
      logWithCorrelation(correlationId, `Message missing critical identifiers: message_id=${message.message_id}, chat_id=${message.chat?.id}`, 'WARN', functionName);
    // Decide if processing should continue or return an error
    // For now, continue but log warning. Consider returning 400 if these are essential.
    }
    // Create media processor instance (handles download/upload/etc.)
    const mediaProcessor = createMediaProcessor(supabaseClient, telegramBotToken);
    // Extract media content (photo, video, document) from the message
    const mediaContent = extractMediaContent(message);
    if (!mediaContent) {
      // If no media found in a message routed here, log warning and return appropriate response
      logWithCorrelation(correlationId, `No media content found in message ${message.message_id}`, 'WARN', functionName);
      // Return 200 OK but indicate skipped, as it's not an error but nothing to process here
      return new Response(JSON.stringify({
        success: true,
        status: 'skipped_no_media',
        message: "No media content found in the message.",
        messageId: message.message_id,
        correlationId
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    logWithCorrelation(correlationId, `Extracted media type: ${mediaContent.mediaType} for message ${message.message_id}`, 'DEBUG', functionName);
    // Determine if the message is an edit (has edit_date or flagged as recovered)
    const isEditedMessage = !!message.edit_date || !!isRecoveredEdit;
    // Check if a message record already exists in the database using telegram_message_id and chat_id
    // This helps detect duplicate webhook calls or retries for the *same* message event.
    const { exists: messageExists, message: existingMessageRecord } = await checkMessageExists(supabaseClient, message.message_id, message.chat?.id, correlationId);
    // Process caption text using retry logic if a caption exists
    const captionData = message.caption ? await processCaptionWithRetry(message.caption, correlationId) : null;
    if (message.caption) {
      logWithCorrelation(correlationId, `Processed caption for message ${message.message_id}`, 'DEBUG', functionName);
    }
    // --- Routing Logic ---
    if (isEditedMessage) {
      // --- Handle Edited Message ---
      if (!messageExists || !existingMessageRecord) {
        // Edited message event received, but the original message isn't in our DB.
        // Treat it as if it were a new message (it might be the first time we see it).
        logWithCorrelation(correlationId, `Edited message ${message.message_id} not found in database, treating as new`, 'INFO', functionName);
        // Pass the current context along
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, context);
      } else {
        // Edited message event received, and we have the original record. Update it.
        logWithCorrelation(correlationId, `Routing edited message ${message.message_id} to handleEditedMessage`, 'DEBUG', functionName);
        // Pass the existing record and context
        return await handleEditedMessage(message, existingMessageRecord, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, context);
      }
    } else {
      // --- Handle New Message ---
      if (messageExists && existingMessageRecord) {
        // New message event received, but DB record already exists (e.g., duplicate webhook).
        // Log this and skip reprocessing.
        logWithCorrelation(correlationId, `Message ${message.message_id} already exists in database (DB ID: ${existingMessageRecord.id}), skipping processing.`, 'INFO', functionName);
        // Return success, indicating it's already processed
        return new Response(JSON.stringify({
          success: true,
          status: 'skipped_duplicate',
          message: "Message already processed (duplicate event)",
          messageId: existingMessageRecord.id,
          correlationId
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } else {
        // New message event, and no existing record. Process it as new.
        logWithCorrelation(correlationId, `Routing new message ${message.message_id} to handleNewMessage`, 'DEBUG', functionName);
        // Pass the context along
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, context);
      }
    }
  } catch (error) {
    // --- Global Error Handling for handleMediaMessage ---
    // Catches unexpected errors not handled within the specific handlers.
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Unhandled exception in handleMediaMessage for message ${message?.message_id}: ${errorMessage}`, 'ERROR', functionName, {
      stack: error instanceof Error ? error.stack : undefined
    });
    // Log the error event to the database for auditing
    await logProcessingEvent(supabaseClient, 'media_handler_exception', null, correlationId, {
      function: functionName,
      telegram_message_id: message?.message_id,
      chat_id: message?.chat?.id,
      error_message: errorMessage,
      error_stack: error instanceof Error ? error.stack : undefined
    }, errorMessage // Error message for logging
    );
    // Return a standardized 500 error response.
    // This error will likely trigger webhook retries from Telegram.
    return createErrorResponse(error, functionName, 500, correlationId, {
      messageId: message?.message_id,
      chatId: message?.chat?.id
    });
  }
}
/**
 * Process a new media message (or an edit treated as new).
 * Downloads media, uploads to storage, and upserts record in the database.
 * Includes logic to skip non-retriable media errors gracefully.
 *
 * @param message - The Telegram message object.
 * @param mediaContent - Extracted media details (type, fileId, uniqueId, etc.).
 * @param mediaProcessor - Instance to handle media download/upload.
 * @param supabaseClient - Supabase client instance.
 * @param captionData - Processed caption data (if any).
 * @param correlationId - Correlation ID for logging and tracing.
 * @param context - Processing context, including isRecoveredEdit flag.
 * @returns A Promise resolving to a Response object.
 */ async function handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, context // Receive context
) {
  const functionName = 'handleNewMessage';
  const { isRecoveredEdit } = context; // Extract flag from context
  // Create a logging prefix for clarity
  const logPrefix = isRecoveredEdit ? `recovered edit ${message.message_id}` : `new message ${message.message_id}`;
  logWithCorrelation(correlationId, `Processing ${logPrefix}`, 'INFO', functionName);
  let processingResult; // Declare here to access media processing results later
  try {
    // --- Step 1: Process the Media ---
    // This involves downloading from Telegram and uploading to Supabase Storage.
    // It returns status, file IDs, paths, potential errors etc.
    processingResult = await mediaProcessor.processMedia(mediaContent, correlationId);
    logWithCorrelation(correlationId, `Media processing result for ${logPrefix}: Status=${processingResult.status}, FileUniqueId=${processingResult.fileUniqueId}`, 'DEBUG', functionName);
    // --- Step 1.5: Handle Non-Retriable Media Errors ---
    // Check if media processing failed with an error we shouldn't retry (e.g., file too large, expired).
    if (processingResult.status === 'error' && isNonRetriableMediaError(processingResult.error)) {
      const errorMsg = processingResult.error instanceof Error ? processingResult.error.message : String(processingResult.error);
      logWithCorrelation(correlationId, `Non-retriable media error for ${logPrefix}: "${errorMsg}". Skipping retries.`, 'WARN', functionName);
      // Attempt to save a record in the DB indicating the skip, but don't fail the request if this DB operation fails.
      try {
        const skipDbResult = await upsertMediaMessageRecord({
          supabaseClient,
          messageId: message.message_id,
          chatId: message.chat?.id,
          caption: message.caption || null,
          mediaType: mediaContent.mediaType,
          fileId: processingResult.fileId || mediaContent.fileId,
          fileUniqueId: processingResult.fileUniqueId || mediaContent.fileUniqueId,
          storagePath: null,
          mimeType: processingResult.mimeType || mediaContent.mimeType,
          extension: processingResult.extension,
          messageData: message,
          processingState: 'skipped_media_error',
          processingError: `Skipped: ${errorMsg}`,
          forwardInfo: extractForwardInfo(message),
          mediaGroupId: message.media_group_id || null,
          captionData: captionData,
          analyzedContent: captionData,
          correlationId,
          additionalUpdates: {} // No additional updates needed here
        });
        if (!skipDbResult.success) {
          // Log DB error but don't throw; we still want to return 200 OK to Telegram.
          logWithCorrelation(correlationId, `Failed to save skipped message record for ${logPrefix}: ${skipDbResult.error?.message}`, 'ERROR', functionName);
        } else {
          logWithCorrelation(correlationId, `Saved message record ${skipDbResult.data?.id} with skipped_media_error state for ${logPrefix}.`, 'INFO', functionName);
        }
      } catch (dbSaveError) {
        // Log exception during DB save but don't throw.
        logWithCorrelation(correlationId, `Exception saving skipped message record for ${logPrefix}: ${dbSaveError.message}`, 'ERROR', functionName);
      }
      // Return a success response (200 OK) to Telegram to prevent webhook retry.
      return new Response(JSON.stringify({
        success: true,
        status: 'skipped_media_error',
        message: `Skipped processing due to non-retriable media error: ${errorMsg}`,
        messageId: message.message_id,
        dbMessageId: null,
        correlationId
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } // End of non-retriable error handling
    // --- Step 2: Determine DB Processing State ---
    // Map the media processing status ('success', 'error', 'duplicate') to the DB state ('completed', 'error', etc.)
    // If media processing resulted in a retriable 'error', the state here will be 'error'.
    let processingState = mapStatusToProcessingState(processingResult.status);
    logWithCorrelation(correlationId, `Media processing status for ${logPrefix}: ${processingResult.status} -> DB state: ${processingState}`, 'INFO', functionName);
    // --- Step 3: Check for Existing Record by File Unique ID ---
    // This handles cases where the *same media file* is sent again, possibly with a different caption or message_id.
    const { success: existingFoundByFile, data: existingMessageDataByFile } = await findMessageByFileUniqueId(supabaseClient, processingResult.fileUniqueId, correlationId);
    let captionChanged = false;
    let additionalUpdates = {}; // To handle specific updates for caption changes
    // --- Step 4: Handle Caption Changes on Existing Files ---
    if (existingFoundByFile && existingMessageDataByFile) {
      logWithCorrelation(correlationId, `Found existing message (DB ID: ${existingMessageDataByFile.id}) with same file_unique_id ${processingResult.fileUniqueId}`, 'INFO', functionName);
      // Compare the new caption with the caption stored in the existing record.
      if (existingMessageDataByFile.caption !== (message.caption || null)) {
        captionChanged = true;
        logWithCorrelation(correlationId, `Caption changed for existing file ${logPrefix}. Old: "${existingMessageDataByFile.caption}", New: "${message.caption}"`, 'INFO', functionName);
        // If caption changed:
        // 1. Reset processing state to 'initialized' to trigger re-analysis/parsing.
        // 2. Prepare to move the *current* analyzed content to the 'old_analyzed_content' field.
        // 3. Prepare to set the 'analyzed_content' field with the new caption data.
        processingState = 'initialized';
        additionalUpdates = {
          old_analyzed_content: existingMessageDataByFile.analyzed_content || null,
          analyzed_content: captionData // Set new analysis based on new caption data
        };
        logWithCorrelation(correlationId, `Prepared additionalUpdates for caption change on ${logPrefix}`, 'DEBUG', functionName);
      } else {
        // If caption hasn't changed for an existing file record.
        logWithCorrelation(correlationId, `Caption has not changed for existing file ${logPrefix}.`, 'INFO', functionName);
      // Keep the processingState determined earlier (e.g., 'completed' if media was duplicate).
      }
    } // End of handling existing file by unique ID
    // --- Step 5: Upsert Message Record to Database ---
    // Use the RPC function which handles INSERT or UPDATE based on primary key (telegram_message_id, chat_id).
    // It also intelligently handles updates based on file_unique_id logic internally (as per the SQL provided earlier).
    let dbResult = {
      success: false,
      error: 'DB operation not attempted'
    };
    try {
      const forwardInfo = extractForwardInfo(message); // Extract forward info consistently
      logWithCorrelation(correlationId, `Calling upsertMediaMessageRecord for ${logPrefix} with state: ${processingState}`, 'DEBUG', functionName);
      dbResult = await upsertMediaMessageRecord({
        supabaseClient,
        messageId: message.message_id,
        chatId: message.chat?.id,
        caption: message.caption || null,
        mediaType: mediaContent.mediaType,
        fileId: processingResult.fileId,
        fileUniqueId: processingResult.fileUniqueId,
        storagePath: processingResult.storagePath,
        mimeType: processingResult.mimeType,
        extension: processingResult.extension,
        messageData: message,
        processingState: processingState,
        processingError: processingResult.error || null,
        forwardInfo: forwardInfo,
        mediaGroupId: message.media_group_id || null,
        captionData: captionData,
        analyzedContent: captionData,
        correlationId,
        additionalUpdates: additionalUpdates // Pass specific updates for caption changes
      });
      // Handle DB Upsert Failure
      if (!dbResult.success || !dbResult.data) {
        const errorMsg = dbResult.error ? dbResult.error.message || JSON.stringify(dbResult.error) : 'DB upsert failed or returned no data';
        logWithCorrelation(correlationId, `Failed to upsert message record for ${logPrefix}: ${errorMsg}`, 'ERROR', functionName);
        // If the DB operation fails *after* a retriable media error occurred,
        // it's likely a genuine DB issue. Let the error propagate to trigger webhook retry.
        if (processingState === 'error') {
          logWithCorrelation(correlationId, `DB upsert failed after retriable media error for ${logPrefix}. Error will propagate for webhook retry.`, 'ERROR', functionName);
          throw dbResult.error || new Error(errorMsg); // Propagate error
        }
        // If DB fails for other reasons (e.g., constraint violation, connection issue), log and return 500.
        await logProcessingEvent(supabaseClient, 'media_message_upsert_failed', null, correlationId, {
          function: functionName,
          telegram_message_id: message.message_id,
          chat_id: message.chat?.id,
          file_unique_id: processingResult.fileUniqueId,
          error_details: errorMsg
        }, dbResult.error || errorMsg);
        // Return 500 to trigger webhook retry for DB issues.
        return createTelegramErrorResponse(`Failed to save message to database: ${errorMsg}`, functionName, 500, correlationId, {
          messageId: message.message_id,
          chatId: message.chat?.id
        });
      } // End DB Upsert Failure Handling
      // DB Upsert Successful
      const savedMessageId = dbResult.data.id; // Get the DB ID (UUID) of the saved/updated record
      logWithCorrelation(correlationId, `Successfully upserted message record for ${logPrefix}. DB ID: ${savedMessageId}`, 'INFO', functionName);
      // --- Step 6: Trigger Post-Processing (Caption Parsing) ---
      // Only trigger parsing if the message processing was successful (state is not 'error' or 'skipped').
      if (processingState !== 'error' && processingState !== 'skipped_media_error') {
        // Trigger if caption changed OR if it's a brand new message with a caption.
        const shouldTriggerParsing = (captionChanged || !existingFoundByFile) && message.caption;
        if (shouldTriggerParsing) {
          logWithCorrelation(correlationId, `Triggering caption parsing for ${logPrefix} (DB ID: ${savedMessageId})`, 'INFO', functionName);
          // Trigger asynchronously (fire and forget) - don't await this.
          triggerCaptionParsing({
            supabaseClient,
            messageId: savedMessageId,
            correlationId
          }).catch((error)=>logWithCorrelation(correlationId, `Error queueing caption parser for ${savedMessageId}: ${error.message}`, 'ERROR', `${functionName}.triggerCaptionParsing`));
          // Log if part of a media group (DB trigger handles actual sync)
          if (message.media_group_id) {
            logWithCorrelation(correlationId, `Caption changed/new for message ${savedMessageId} in media group ${message.media_group_id}. DB trigger handles sync.`, 'INFO', functionName);
          }
        }
      } else {
        // Log if parsing is skipped due to processing state
        logWithCorrelation(correlationId, `Skipping caption parsing trigger due to processing state: ${processingState} for ${logPrefix}`, 'INFO', functionName);
      } // End Caption Parsing Trigger
    } catch (dbError) {
      // Catch unexpected errors during the database operation phase.
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      logWithCorrelation(correlationId, `Database operation exception for ${logPrefix}: ${errorMsg}`, 'ERROR', functionName, {
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      // Let this error propagate up to handleMediaMessage's catch block to trigger webhook retry.
      throw dbError;
    } // End DB Operation Try/Catch
    // --- Step 7: Return Success Response ---
    // Log final success status for this handler.
    logWithCorrelation(correlationId, `Successfully processed ${logPrefix}. Final DB State: ${processingState}. DB ID: ${dbResult.data?.id}`, 'INFO', functionName);
    const processingTimeMs = message.date ? Date.now() - new Date(message.date * 1000).getTime() : undefined;
    // Construct the success response body
    const responseBody = {
      success: true,
      // Provide a status reflecting the outcome
      status: processingState === 'error' ? 'processed_with_media_error' : captionChanged ? 'updated_caption' : existingFoundByFile ? 'updated_existing_file' : 'created',
      message: `Message ${processingState === 'error' ? 'processed with retriable media error' : captionChanged ? 'caption updated' : existingFoundByFile ? 'record updated' : 'processed successfully'}`,
      messageId: message.message_id,
      dbMessageId: dbResult.data?.id || 'unknown',
      processingTimeMs: processingTimeMs,
      captionChanged: captionChanged,
      mediaProcessingStatus: processingResult.status,
      correlationId
    };
    // Return 200 OK response to Telegram.
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // --- Global Error Handling for handleNewMessage ---
    // Catches errors from Step 1 (media processing) or other unexpected issues.
    // These errors will propagate up and likely trigger webhook retries from Telegram.
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Error processing ${logPrefix}: ${errorMessage}`, 'ERROR', functionName, {
      stack: error instanceof Error ? error.stack : undefined
    });
    // Log the error event for auditing before throwing
    await logProcessingEvent(supabaseClient, 'media_message_processing_error', null, correlationId, {
      function: functionName,
      telegram_message_id: message.message_id,
      chat_id: message.chat?.id,
      media_status: processingResult?.status,
      error_details: errorMessage,
      error_stack: error instanceof Error ? error.stack : undefined
    }, error // Pass the original error object
    );
    // Re-throw the error to allow the main webhook retry handler (in index.ts) to catch it.
    // This ensures that Telegram retries the webhook call for potentially transient errors.
    throw error;
  } // End Global Try/Catch for handleNewMessage
}
/**
 * Process an edited media message that already exists in the database.
 * Checks for changes in media or caption and updates the record accordingly.
 * Includes logic to skip non-retriable media errors if media changed.
 *
 * @param message - The updated Telegram message object (edited_message payload).
 * @param existingMessageRecord - The existing message record from the database.
 * @param mediaContent - Extracted media details from the edited message.
 * @param mediaProcessor - Instance to handle media download/upload if needed.
 * @param supabaseClient - Supabase client instance.
 * @param captionData - Processed caption data from the edited message.
 * @param correlationId - Correlation ID for logging and tracing.
 * @param context - Processing context, including waitUntil for background tasks.
 * @returns A Promise resolving to a Response object.
 */ async function handleEditedMessage(message, existingMessageRecord, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, context // Receive context for background tasks
) {
  const functionName = 'handleEditedMessage';
  logWithCorrelation(correlationId, `Processing edited message ${message.message_id} (DB ID: ${existingMessageRecord.id})`, 'INFO', functionName);
  let processingResult; // To store media processing result if media changes
  try {
    // --- Step 1: Detect Changes ---
    // Check if media content (file itself) has changed by comparing file_unique_id.
    const currentFileUniqueId = mediaContent.fileUniqueId;
    const hasNewMedia = currentFileUniqueId !== existingMessageRecord.file_unique_id;
    if (hasNewMedia) {
      logWithCorrelation(correlationId, `Media content changed for edited message ${message.message_id}. Old unique_id: ${existingMessageRecord.file_unique_id}, New: ${currentFileUniqueId}`, 'INFO', functionName);
    }
    // Check if the caption text has changed.
    const captionChanged = (message.caption || null) !== (existingMessageRecord.caption || null);
    if (captionChanged) {
      logWithCorrelation(correlationId, `Caption changed for edited message ${message.message_id}. Old: "${existingMessageRecord.caption}", New: "${message.caption}"`, 'INFO', functionName);
    }
    // --- Step 2: Handle No Changes ---
    // If neither the media file nor the caption text changed, there's nothing to update.
    if (!hasNewMedia && !captionChanged) {
      logWithCorrelation(correlationId, `No relevant changes detected in edited message ${message.message_id}, skipping update.`, 'INFO', functionName);
      // Return 200 OK to Telegram, indicating successful handling (no action needed).
      return new Response(JSON.stringify({
        success: true,
        status: 'skipped_no_change',
        message: "No relevant changes detected in edited message",
        messageId: existingMessageRecord.id,
        correlationId
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } // End No Changes check
    // --- Step 3: Prepare Base Updates ---
    // Initialize an object to hold all updates for the database record.
    const updates = {
      // Fields always updated on any relevant edit
      last_edited_at: new Date(message.edit_date * 1000).toISOString(),
      correlation_id: correlationId,
      message_data: message,
      is_edit: true // Flag this update as originating from an edit
    };
    // --- Step 4: Update Edit History ---
    // Create an entry capturing the state *before* this edit.
    const editHistoryEntry = {
      edited_at: new Date(message.edit_date * 1000).toISOString(),
      previous_caption: existingMessageRecord.caption,
      previous_caption_data: existingMessageRecord.caption_data,
      previous_file_unique_id: existingMessageRecord.file_unique_id,
      previous_storage_path: existingMessageRecord.storage_path,
      previous_public_url: existingMessageRecord.public_url,
      correlation_id: correlationId // Link history entry to this specific edit event
    };
    // Prepend the new entry to the existing history array (or initialize if null).
    updates.edit_history = [
      editHistoryEntry,
      ...existingMessageRecord.edit_history || []
    ];
    // --- Step 5: Update Forward Info (if changed) ---
    // Extract forward info from the edited message payload.
    const forwardInfo = extractForwardInfo(message);
    // Check if the forward status or details have changed compared to the existing record.
    if (JSON.stringify(forwardInfo) !== JSON.stringify(existingMessageRecord.forward_info)) {
      updates.forward_info = forwardInfo;
      updates.is_forward = !!forwardInfo;
      logWithCorrelation(correlationId, `Forward info updated for edited message ${message.message_id}.`, 'INFO', functionName);
    }
    // --- Step 6: Process New Media (if changed) ---
    let mediaInfoForUpdate = null; // Info needed by updateMessageRecord if media changed
    let skipMediaProcessing = false; // Flag if non-retriable error occurs
    if (hasNewMedia) {
      logWithCorrelation(correlationId, `Processing new media for edited message ${message.message_id}`, 'INFO', functionName);
      // Process the new media file (download/upload).
      processingResult = await mediaProcessor.processMedia(mediaContent, correlationId);
      logWithCorrelation(correlationId, `New media processing status for edited message ${message.message_id}: ${processingResult.status}`, 'DEBUG', functionName);
      // --- Step 6.1: Handle Non-Retriable Errors for New Media ---
      if (processingResult.status === 'error' && isNonRetriableMediaError(processingResult.error)) {
        const errorMsg = processingResult.error instanceof Error ? processingResult.error.message : String(processingResult.error);
        logWithCorrelation(correlationId, `Non-retriable media error during edit for message ${message.message_id}: "${errorMsg}". Skipping media update, marking state as skipped.`, 'WARN', functionName);
        // Set state to indicate skipped media, store the error.
        updates.processing_state = 'skipped_media_error'; // Ensure ENUM exists
        updates.processing_error = `Skipped edit media update: ${errorMsg}`;
        // Do *not* update media-related fields (file_id, unique_id, storage_path, etc.).
        skipMediaProcessing = true; // Set flag
      } else {
        // --- Step 6.2: Update Media Fields (Success, Duplicate, or Retriable Error) ---
        const processingState = mapStatusToProcessingState(processingResult.status);
        updates.file_unique_id = processingResult.fileUniqueId; // Update to the new file's unique ID
        updates.file_id = processingResult.fileId; // Update file_id as well
        updates.storage_path = processingResult.storagePath; // Path if successful, null if retriable error
        updates.mime_type = processingResult.mimeType; // Update MIME type
        updates.extension = processingResult.extension; // Update extension
        updates.processing_state = processingState; // Set state ('completed' or 'error')
        updates.processing_error = processingResult.error || null; // Store retriable error message if any
        // Prepare media info object for the updateMessageRecord call (excluding publicUrl).
        mediaInfoForUpdate = {
          fileUniqueId: updates.file_unique_id,
          storagePath: updates.storage_path,
          mimeType: updates.mime_type,
          extension: updates.extension
        };
      } // End handling media processing result
    } // End if(hasNewMedia)
    // --- Step 7: Process Caption Changes ---
    if (captionChanged) {
      updates.caption = message.caption || null; // Update caption field in DB
      updates.caption_data = captionData; // Update processed caption data
      updates.analyzed_content = captionData; // Update analyzed content based on new caption
      // Store the *current* analyzed_content (before this edit) in old_analyzed_content.
      updates.old_analyzed_content = existingMessageRecord.analyzed_content || null;
      // Reset processing state to trigger re-analysis, *unless* a non-retriable media error occurred.
      if (updates.processing_state !== 'skipped_media_error') {
        // Also don't reset if media processing resulted in a retriable error, keep 'error' state.
        if (updates.processing_state !== 'error') {
          updates.processing_state = 'initialized';
        }
      }
      logWithCorrelation(correlationId, `Caption changed for edited message ${message.message_id}. State set to: ${updates.processing_state}`, 'INFO', functionName);
    } // End if(captionChanged)
    // --- Step 8: Update Database Record ---
    // Call updateMessageRecord to apply all collected changes.
    // This function handles applying the 'updates' object to the 'existingMessageRecord'.
    logWithCorrelation(correlationId, `Calling updateMessageRecord for edited message ${existingMessageRecord.id}. Skip flag: ${skipMediaProcessing}`, 'DEBUG', functionName);
    const updateResult = await updateMessageRecord(supabaseClient, existingMessageRecord, message, skipMediaProcessing ? null : mediaInfoForUpdate, captionData, correlationId, updates // Pass the consolidated updates object containing history, timestamps, state, etc.
    );
    // Handle DB Update Failure
    if (!updateResult || !updateResult.success) {
      const errorMsg = updateResult ? JSON.stringify(updateResult.error) : 'Update operation failed';
      logWithCorrelation(correlationId, `Failed to update message record ${existingMessageRecord.id} during edit: ${errorMsg}`, 'ERROR', functionName);
      // If the DB update fails, let the error propagate up to trigger webhook retry.
      throw updateResult?.error || new Error(errorMsg);
    } // End DB Update Failure Handling
    // --- Step 9: Post-Update Actions (Async) ---
    // Perform actions like syncing media groups or triggering parsing only if the update wasn't skipped due to media error.
    if (!skipMediaProcessing) {
      // Sync media group content if caption changed (run in background)
      if (captionChanged && message.media_group_id && captionData && context.waitUntil) {
        logWithCorrelation(correlationId, `Edited message ${existingMessageRecord.id} part of media group ${message.media_group_id}, queueing analyzed content sync.`, 'INFO', functionName);
        context.waitUntil((async ()=>{
          try {
            await new Promise((resolve)=>setTimeout(resolve, 500)); // Optional delay
            logWithCorrelation(correlationId, `Executing background sync for media group ${message.media_group_id}`, 'INFO', `${functionName}.syncMediaGroup`);
            const { data, error } = await supabaseClient.rpc('x_sync_media_group_analyzed_content', {
              p_media_group_id: message.media_group_id,
              p_source_message_id: existingMessageRecord.id,
              p_analyzed_content: captionData // New analyzed content to sync
            });
            if (error) {
              logWithCorrelation(correlationId, `Error syncing media group ${message.media_group_id} analyzed content: ${error.message}`, 'ERROR', `${functionName}.syncMediaGroup`);
            } else {
              logWithCorrelation(correlationId, `Successfully synced ${data ?? 0} messages in media group ${message.media_group_id}`, 'INFO', `${functionName}.syncMediaGroup`);
            }
          } catch (syncError) {
            const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
            logWithCorrelation(correlationId, `Exception during media group sync for ${message.media_group_id}: ${errorMessage}`, 'ERROR', `${functionName}.syncMediaGroup`);
          }
        })());
      } // End media group sync
      // Trigger caption parsing if caption changed (run in background)
      if (captionChanged && message.caption) {
        logWithCorrelation(correlationId, `Caption changed for edited message ${existingMessageRecord.id}, triggering parser.`, 'INFO', functionName);
        triggerCaptionParsing({
          supabaseClient,
          messageId: existingMessageRecord.id,
          correlationId
        }).catch((error)=>logWithCorrelation(correlationId, `Error triggering parser for edit ${existingMessageRecord.id}: ${error.message}`, 'ERROR', `${functionName}.parseTrigger`));
      } // End caption parsing trigger
    } // End post-update actions
    // --- Step 10: Return Success Response ---
    // Determine the final status message based on whether media processing was skipped.
    const finalStatus = skipMediaProcessing ? 'updated_skipped_media' : 'updated';
    logWithCorrelation(correlationId, `Successfully processed edited message ${message.message_id} (DB ID: ${existingMessageRecord.id}). Final Status: ${finalStatus}`, 'INFO', functionName);
    // Return 200 OK to Telegram, indicating successful handling (even if media was skipped).
    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      message: `Edited message ${skipMediaProcessing ? 'processed, but media update skipped due to error' : 'processed successfully'}`,
      messageId: existingMessageRecord.id,
      telegramMessageId: message.message_id,
      mediaChanged: hasNewMedia && !skipMediaProcessing,
      captionChanged: captionChanged,
      mediaSkipped: skipMediaProcessing,
      correlationId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // --- Global Error Handling for handleEditedMessage ---
    // Catches errors during media processing (if not skipped), DB updates, or other logic.
    // These errors will propagate up and likely trigger webhook retries.
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Error processing edited media message ${message?.message_id}: ${errorMessage}`, 'ERROR', functionName, {
      stack: error instanceof Error ? error.stack : undefined
    });
    // Log the error event for auditing before throwing
    await logProcessingEvent(supabaseClient, 'edited_media_message_processing_error', existingMessageRecord?.id || null, correlationId, {
      function: functionName,
      telegram_message_id: message?.message_id,
      chat_id: message?.chat?.id,
      media_status: processingResult?.status,
      error_details: errorMessage,
      error_stack: error instanceof Error ? error.stack : undefined
    }, error // Pass original error
    );
    // Re-throw the error to allow the main webhook retry handler (in index.ts) to catch it.
    throw error;
  } // End Global Try/Catch for handleEditedMessage
}

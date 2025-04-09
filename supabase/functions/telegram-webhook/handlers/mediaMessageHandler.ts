/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts"; 
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { MediaProcessor, ProcessingResult } from "../../_shared/MediaProcessor.ts";
import { createMediaProcessor } from "../../_shared/mediaUtils.ts";
import { handleError, createErrorResponse } from "../../_shared/ErrorHandler.ts";
import { supabaseClient } from "../../_shared/supabase.ts";

// Local Imports
import {
    MessageContext,
    TelegramMessage,
} from '../types.ts';
import { 
    createMessageRecord, 
    updateMessageRecord, 
    findMessageByTelegramId,
    updateMessageWithError,
    logProcessingEvent,
    upsertMediaMessageRecord,
    triggerCaptionParsing
} from '../utils/dbOperations.ts';
import { 
    extractMediaContent, 
    checkMessageExists, 
    processCaptionWithRetry, 
    processMessageMedia 
} from '../utils/messageUtils.ts';

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('CRITICAL: Missing TELEGRAM_BOT_TOKEN environment variable. Function cannot proceed.');
  throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN'); 
}

/**
 * Unified handler for both new and edited media messages.
 * This handler consolidates the logic for processing media messages,
 * reducing code duplication and improving maintainability.
 * 
 * @param message - The Telegram message to process
 * @param supabaseClient - The Supabase client for database operations
 * @param correlationId - The correlation ID for request tracking
 * @returns A Response object with the processing result
 * @example
 * const response = await handleMediaMessage(
 *   message,
 *   supabaseClient,
 *   correlationId
 * );
 */
export async function handleMediaMessage(
  message: TelegramMessage,
  supabaseClient: SupabaseClient,
  correlationId: string
): Promise<Response> {
  const functionName = 'handleMediaMessage';
  console.log(`[${correlationId}][${functionName}] Processing message ${message.message_id} in chat ${message.chat.id}`);
  
  try {
    // Validate required environment variables
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set");
    }
    
    // Create media processor
    const mediaProcessor = createMediaProcessor(supabaseClient, telegramBotToken);
    
    // Extract media content
    const mediaContent = extractMediaContent(message);
    if (!mediaContent) {
      return createErrorResponse(
        "No media content found in message",
        functionName,
        400,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // Check if this is an edited message
    const isEditedMessage = !!message.edit_date;
    
    // Check if message already exists in database
    const { exists: messageExists, message: existingMessage } = await checkMessageExists(
      supabaseClient,
      message.message_id,
      message.chat.id,
      correlationId
    );
    
    // Process caption if present
    const captionData = await processCaptionWithRetry(message.caption, correlationId);
    
    // Handle based on message existence and edit status
    if (isEditedMessage) {
      // This is an edited message
      if (!messageExists) {
        // Edited message not found in database, treat as new
        console.log(`[${correlationId}][${functionName}] Edited message ${message.message_id} not found in database, treating as new`);
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      } else {
        // Edited message found in database, update it
        return await handleEditedMessage(message, existingMessage, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      }
    } else {
      // This is a new message
      if (messageExists) {
        // Message already exists in database, return existing record
        console.log(`[${correlationId}][${functionName}] Message ${message.message_id} already exists in database`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Message already processed",
            messageId: existingMessage.id,
            correlationId
          }),
          { status: 200 }
        );
      } else {
        // New message, process it
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      }
    }
  } catch (error) {
    // Handle error with comprehensive logging
    const errorResult = await handleError(error, {
      context: {
        message,
        correlationId,
        functionName
      },
      supabaseClient
    });
    
    // Return standardized error response
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      functionName,
      500,
      correlationId,
      { messageId: message.message_id, chatId: message.chat.id }
    );
  }
}

/**
 * Process a new media message
 * 
 * @param message - The Telegram message to process
 * @param mediaContent - The extracted media content
 * @param mediaProcessor - The MediaProcessor instance
 * @param supabaseClient - The Supabase client for database operations
 * @param captionData - The processed caption data
 * @param correlationId - The correlation ID for request tracking
 * @returns A Response object with the processing result
 */
async function handleNewMessage(
  message: TelegramMessage,
  mediaContent: any,
  mediaProcessor: MediaProcessor,
  supabaseClient: SupabaseClient,
  captionData: any,
  correlationId: string
): Promise<Response> {
  const functionName = 'handleNewMessage';
  console.log(`[${correlationId}][${functionName}] Processing new message ${message.message_id}`);
  
  try {
    // Process media
    const processingResult = await mediaProcessor.processMedia(
      mediaContent,
      correlationId
    );

    const processingState = mapStatusToProcessingState(processingResult.status);
    console.log(`[${correlationId}][${functionName}] Media processing status for message ${message.message_id}: ${processingResult.status} -> DB state: ${processingState}`);

    // Check if this message already exists in the database
    const existingMessage = await findMessageByFileUniqueId(
      supabaseClient,
      processingResult.fileUniqueId,
      correlationId
    );

    // Flag to track if caption has changed
    let captionChanged = false;
    
    if (existingMessage.success && existingMessage.data) {
      // Check if caption has changed
      if (existingMessage.data.caption !== message.caption) {
        captionChanged = true;
        console.log(`[${correlationId}][${functionName}] Caption changed for message ${message.message_id}. Old: "${existingMessage.data.caption}", New: "${message.caption}"`);
      }
    }

    // Use the upsert function to handle duplicate file_unique_id
    const dbResult = await upsertMediaMessageRecord({
      supabaseClient,
      messageId: message.message_id,
      chatId: message.chat.id,
      userId: message.from?.id,
      messageDate: new Date(message.date * 1000),
      caption: message.caption || null,
      mediaType: mediaContent.type,
      fileId: processingResult.fileId,
      fileUniqueId: processingResult.fileUniqueId,
      storagePath: processingResult.storagePath,
      publicUrl: processingResult.publicUrl,
      mimeType: processingResult.mimeType,
      extension: processingResult.extension,
      messageData: message as unknown as Json,
      processingState: processingState,
      processingError: processingResult.error || null,
      forwardInfo: message.forward_date ? { 
        date: message.forward_date,
        fromChatId: message.forward_from_chat?.id,
        fromChatType: message.forward_from_chat?.type,
        fromMessageId: message.forward_from_message_id,
        fromChatTitle: message.forward_from_chat?.title,
        fromSenderName: message.forward_sender_name,
        fromSignature: message.forward_signature
      } : null,
      mediaGroupId: message.media_group_id || null,
      captionData: captionData,
      correlationId
    });

    if (!dbResult.success) {
      console.error(`[${correlationId}][${functionName}] Failed to create message: ${dbResult.error}`);
      
      // Log the error
      await logProcessingEvent(
        supabaseClient,
        'media_message_creation_failed',
        'N/A',
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_group_id: message.media_group_id,
          error_type: typeof dbResult.error,
          error_keys: Object.keys(dbResult.error || {})
        },
        dbResult.error
      );
      
      return createErrorResponse(
        `Failed to create message: ${dbResult.error}`,
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }

    // If caption has changed, trigger the caption parser
    if (captionChanged && message.caption) {
      console.log(`[${correlationId}][${functionName}] Caption changed, triggering parser for message ${dbResult.data.id}`);
      
      // Trigger caption parsing asynchronously
      triggerCaptionParsing({
        supabaseClient,
        messageId: dbResult.data.id,
        correlationId
      }).catch(error => {
        console.error(`[${correlationId}][${functionName}] Error triggering caption parser: ${error instanceof Error ? error.message : String(error)}`);
      });
    }

    // Log success
    console.log(`[${correlationId}][${functionName}] Successfully processed message ${message.message_id}`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processed successfully",
        messageId: dbResult.data.id,
        processingTime: Date.now() - new Date(message.date * 1000).getTime(),
        captionChanged,
        correlationId
      }),
      { status: 200 }
    );
  } catch (error) {
    // Handle error with comprehensive logging
    console.error(`[${correlationId}][${functionName}] Error processing media message: ${error instanceof Error ? error.message : String(error)}`, error);
    
    // Log the error
    await logProcessingEvent(
      supabaseClient,
      'media_message_processing_error',
      'N/A',
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id
      },
      error instanceof Error ? error.message : String(error)
    );
    
    return createErrorResponse(
      `Error processing media message: ${error instanceof Error ? error.message : String(error)}`,
      functionName,
      500,
      correlationId,
      { messageId: message.message_id, chatId: message.chat.id }
    );
  }
}

/**
 * Find a message by its file_unique_id
 * 
 * @param supabaseClient - The Supabase client
 * @param fileUniqueId - The file_unique_id to search for
 * @param correlationId - Correlation ID for request tracking
 * @returns Operation result with the message if found
 */
async function findMessageByFileUniqueId(
  supabaseClient: SupabaseClient,
  fileUniqueId: string,
  correlationId: string
): Promise<DbOperationResult<{ id: string; caption: string | null; analyzed_content: any }>> {
  const functionName = 'findMessageByFileUniqueId';
  
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('id, caption, analyzed_content')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();
    
    if (error) {
      console.error(`[${correlationId}][${functionName}] Error finding message by file_unique_id ${fileUniqueId}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
    
    if (!data) {
      return {
        success: false,
        error: 'Message not found'
      };
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}][${functionName}] Exception finding message: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Process an edited media message
 * 
 * @param message - The updated Telegram message
 * @param existingMessage - The existing message record from the database
 * @param mediaContent - The extracted media content
 * @param mediaProcessor - The MediaProcessor instance
 * @param supabaseClient - The Supabase client for database operations
 * @param captionData - The processed caption data
 * @param correlationId - The correlation ID for request tracking
 * @returns A Response object with the processing result
 */
async function handleEditedMessage(
  message: TelegramMessage,
  existingMessage: any,
  mediaContent: any,
  mediaProcessor: MediaProcessor,
  supabaseClient: SupabaseClient,
  captionData: any,
  correlationId: string
): Promise<Response> {
  const functionName = 'handleEditedMessage';
  console.log(`[${correlationId}][${functionName}] Processing edited message ${message.message_id}`);
  
  try {
    // Check if media has changed by comparing file_unique_id
    const currentFileUniqueId = mediaContent.file_unique_id;
    const hasNewMedia = currentFileUniqueId !== existingMessage.file_unique_id;
    
    // Check if caption has changed
    const captionChanged = message.caption !== existingMessage.caption;
    
    // If neither media nor caption changed, return early
    if (!hasNewMedia && !captionChanged) {
      console.log(`[${correlationId}][${functionName}] No changes detected in edited message ${message.message_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "No changes detected in edited message",
          messageId: existingMessage.id,
          correlationId
        }),
        { status: 200 }
      );
    }
    
    // Create edit history entry
    const editHistory = existingMessage.edit_history || [];
    editHistory.push({
      edited_at: message.edit_date,
      previous_caption: existingMessage.caption,
      previous_caption_data: existingMessage.caption_data,
      previous_file_unique_id: existingMessage.file_unique_id,
      previous_storage_path: existingMessage.storage_path,
      previous_public_url: existingMessage.public_url
    });
    
    // Prepare updates for the message record
    const updates: any = {
      caption: message.caption,
      caption_data: captionData,
      edit_history: editHistory,
      last_edited_at: new Date(message.edit_date * 1000).toISOString(),
      correlation_id: correlationId,
    };
    
    // If media has changed, process the new media
    if (hasNewMedia) {
      console.log(`[${correlationId}][${functionName}] Media changed in edited message ${message.message_id}`);
      
      // Process new media
      const processingResult = await mediaProcessor.processMedia(
        mediaContent,
        correlationId
      );
      
      const processingState = mapStatusToProcessingState(processingResult.status);
      console.log(`[${correlationId}][${functionName}] Media processing status for edited message ${message.message_id}: ${processingResult.status} -> DB state: ${processingState}`);
      
      // Update media fields
      if (processingResult.fileInfo) {
        updates.file_unique_id = processingResult.fileUniqueId;
        updates.storage_path = processingResult.storagePath;
        updates.public_url = processingResult.publicUrl;
        updates.mime_type = processingResult.mimeType;
        updates.file_size = processingResult.fileSize;
        updates.content_disposition = processingResult.contentDisposition;
      }
      updates.processingState = processingState;
      updates.processingError = processingResult.error || null;
    } else if (message.text) {
        logWithCorrelation(correlationId, `Edited message ${message.message_id} is a text message. Routing update to separate handler (TODO).`, "info");
        // Update logic for text messages might go here or in handleTextMessage
        // This should interact with 'other_messages' table
        processingState = "processed"; // Assume simple text update is 'processed' for now
    } else {
        logWithCorrelation(correlationId, `Edited message ${message.message_id} has no media or text to update.`, "info");
        return new Response("OK", { headers: corsHeaders }); // Nothing to do
    }
    
    // Update message record using the new database operation function
    const updateResult = await updateMessageRecord(
      supabaseClient,
      existingMessage.id,
      updates,
      correlationId
    );
    
    if (!updateResult.success) {
      throw new Error(`Failed to update message record: ${updateResult.error}`);
    }
    
    // Log the edit event
    await logProcessingEvent(
      supabaseClient,
      'message_edited',
      existingMessage.id,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_changed: hasNewMedia,
        caption_changed: captionChanged
      }
    );
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: existingMessage.id,
        mediaChanged: hasNewMedia,
        captionChanged: captionChanged,
        correlationId
      }),
      { status: 200 }
    );
  } catch (error) {
    // Handle error with comprehensive logging
    const errorResult = await handleError(error, {
      context: {
        message,
        existingMessage,
        correlationId,
        functionName
      },
      supabaseClient
    });
    
    // If we have the existing message ID, update it with error information
    if (existingMessage?.id) {
      await updateMessageWithError(
        supabaseClient,
        existingMessage.id,
        error instanceof Error ? error.message : String(error),
        'EditedMessageProcessingError',
        correlationId
      );
    }
    
    // Return standardized error response
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      functionName,
      500,
      correlationId,
      { messageId: message.message_id, chatId: message.chat.id }
    );
  }
}

// Helper function to map ProcessingResult status to ProcessingState
function mapStatusToProcessingState(status: ProcessingResult['status']): ProcessingState {
  switch (status) {
    case "success":
      return "processed";
    case "duplicate":
      return "duplicate";
    case "download_failed_forwarded":
      return "download_failed_forwarded";
    case "error":
      return "error";
    default:
      // Should not happen if all statuses are handled
      console.warn(`Unhandled ProcessingResult status: ${status}`);
      return "error";
  }
}

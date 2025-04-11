/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createCorsResponse, supabaseClient } from "../../_shared/cors.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { MediaProcessor, ProcessingResult } from "../../_shared/MediaProcessor.ts";
import { createMediaProcessor } from "../../_shared/mediaUtils.ts";
import { handleError } from "../../_shared/ErrorHandler.ts";

// Error handling
import { createTelegramErrorResponse } from "../utils/errorUtils.ts";

// Local Imports
import {
    MessageContext,
    TelegramMessage,
} from '../types.ts';
import { 
    createMessageRecord, 
    updateMessageRecord, 
    findMessageByTelegramId,
    findMessageByFileUniqueId,
    updateMessageWithError,
    logProcessingEvent,
    upsertMediaMessageRecord,
    triggerCaptionParsing,
    findMessagesByMediaGroupId,
    syncMediaGroupCaptions,
    extractForwardInfo
} from '../utils/dbOperations.ts';
import { 
    extractMediaContent, 
    checkMessageExists, 
    processCaptionWithRetry, 
    processMessageMedia 
} from '../utils/messageUtils.ts';
import { logWithCorrelation } from '../utils/logger.ts';

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  logWithCorrelation('system', 'CRITICAL: Missing TELEGRAM_BOT_TOKEN environment variable. Function cannot proceed.', 'ERROR');
  throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN'); 
}

/**
 * Map a processing status to a database processing state
 */
function mapStatusToProcessingState(status: string): string {
  switch (status) {
    case 'success':
      return 'completed';
    case 'duplicate':
      return 'completed';
    case 'error':
      return 'error';
    default:
      return 'pending_analysis';
  }
}

/**
 * Create a standardized error response
 */
function createErrorResponse(
  error: string,
  functionName: string,
  status = 500,
  correlationId?: string,
  metadata?: Record<string, any>
): Response {
  return createTelegramErrorResponse(
    error,
    functionName,
    status,
    correlationId,
    metadata
  );
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
  telegramBotToken: string,
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  const functionName = 'handleMediaMessage';
  logWithCorrelation(correlationId, `Processing message ${message.message_id} in chat ${message.chat.id}`, 'INFO', functionName);
  
  try {
    // Validate required environment variables
    if (!telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set");
    }
    
    // Create media processor
    const mediaProcessor = createMediaProcessor(supabaseClient, telegramBotToken);
    
    // Extract media content
    const mediaContent = extractMediaContent(message);
    if (!mediaContent) {
      return createTelegramErrorResponse(
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
        logWithCorrelation(correlationId, `Edited message ${message.message_id} not found in database, treating as new`, 'INFO', functionName);
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      } else {
        // Edited message found in database, update it
        return await handleEditedMessage(message, existingMessage, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      }
    } else {
      // This is a new message
      if (messageExists) {
        // Message already exists in database, return existing record
        logWithCorrelation(correlationId, `Message ${message.message_id} already exists in database`, 'INFO', functionName);
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
  logWithCorrelation(correlationId, `Processing new message ${message.message_id}`, 'INFO', functionName);
  
  try {
    // Process media
    const processingResult = await mediaProcessor.processMedia(
      mediaContent,
      correlationId
    );

    // Variable can be reassigned later if caption changes
    let processingState = mapStatusToProcessingState(processingResult.status);
    logWithCorrelation(correlationId, `Media processing status for message ${message.message_id}: ${processingResult.status} -> DB state: ${processingState}`, 'INFO', functionName);

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
        logWithCorrelation(correlationId, `Caption changed for message ${message.message_id}. Old: "${existingMessage.data.caption}", New: "${message.caption}"`, 'INFO', functionName);
        
        // When caption changes, we need to:
        // 1. Move current analyzed_content to old_analyzed_content array
        // 2. Reset processing_state to trigger reprocessing
        // 3. Set analyzed_content to new captionData
        // We'll handle this by preparing additional updates for the upsert operation
      }
    }

    // Define dbResult outside the inner try block to fix the variable scope issue
    let dbResult: any = { success: false, error: 'Not initialized' };

    // Use the upsert function to handle duplicate file_unique_id
    // PostgreSQL function extracts message_date, chat_type, chat_title from message data
    try {
      // Use extractForwardInfo for consistent handling of forward data
      const forwardInfo = message.forward_date ? extractForwardInfo(message) : null;
      const isForwarded = !!message.forward_date;
      
      // Prepare additional updates for caption changes in existing messages
      let additionalUpdates = {};
      
      if (captionChanged && existingMessage.success && existingMessage.data) {
        // Reset processing state to trigger reprocessing
        processingState = 'initialized';
        
        // If the message has analyzed content, prepare the old_analyzed_content update
        // But construct it in a way that avoids SQL reassignment issues
        if (existingMessage.data.analyzed_content) {
          // Create a properly formatted old_analyzed_content array manually
          // avoiding the problematic SQL reassignment
          let oldContent;
          
          if (existingMessage.data.old_analyzed_content) {
            // If old_analyzed_content already exists as an array, copy it and append
            try {
              // Make a deep copy to avoid mutation issues
              oldContent = JSON.parse(JSON.stringify(existingMessage.data.old_analyzed_content));
              // Add the current analyzed_content as a new item
              oldContent.push(existingMessage.data.analyzed_content);
            } catch (error) {
              // Fallback if there's any parsing issue
              logWithCorrelation(correlationId, `Error processing old_analyzed_content: ${error instanceof Error ? error.message : String(error)}`, 'WARN', functionName);
              // Create a new array with existing content to ensure we don't lose data
              if (Array.isArray(existingMessage.data.old_analyzed_content)) {
                // If it's an array but JSON.parse failed, try to use it directly
                oldContent = [...existingMessage.data.old_analyzed_content, existingMessage.data.analyzed_content];
              } else {
                // Complete fallback - start fresh with just the current analyzed content
                oldContent = [existingMessage.data.analyzed_content];
              }
            }
          } else {
            // If old_analyzed_content doesn't exist, create a new array
            oldContent = [existingMessage.data.analyzed_content];
          }
          
          additionalUpdates = {
            old_analyzed_content: oldContent,
            // Set the new analyzed content
            analyzed_content: captionData
          };
        }
      }

      dbResult = await upsertMediaMessageRecord({
        supabaseClient,
        messageId: message.message_id,
        chatId: message.chat.id,
        caption: message.caption || null,
        mediaType: mediaContent.mediaType,
        fileId: processingResult.fileId,
        fileUniqueId: processingResult.fileUniqueId,
        storagePath: processingResult.storagePath,
        publicUrl: processingResult.publicUrl,
        mimeType: processingResult.mimeType,
        extension: processingResult.extension,
        messageData: message as unknown as Json,  // Use messageData to match PostgreSQL parameter
        processingState: processingState,         // Ensure this matches the enum in PostgreSQL
        processingError: processingResult.error || null,
        forwardInfo: forwardInfo,                 // Use standardized forward info
        mediaGroupId: message.media_group_id || null,
        captionData: captionData,                 // Processed caption data structure
        analyzedContent: captionData,             // Keep in sync with captionData
        correlationId,
        additionalUpdates: additionalUpdates      // Include our additional updates for caption changes
      });
      
      if (!dbResult.success) {
        logWithCorrelation(correlationId, `Failed to create message: ${dbResult.error}`, 'ERROR', functionName);
        
        // Log the error
        await logProcessingEvent(
          supabaseClient,
          'media_message_creation_failed',
          crypto.randomUUID(), 
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
        
        return createTelegramErrorResponse(
          `Failed to create message: ${dbResult.error}`,
          functionName,
          500,
          correlationId,
          { messageId: message.message_id, chatId: message.chat.id }
        );
      }

      // If caption has changed, trigger the caption parser
      if (captionChanged && message.caption) {
        logWithCorrelation(correlationId, `Caption changed, triggering parser for message ${dbResult.data.id}`, 'INFO', functionName);
        
        // Trigger caption parsing asynchronously
        triggerCaptionParsing({
          supabaseClient,
          messageId: dbResult.data.id,
          correlationId
        }).catch(error => {
          logWithCorrelation(correlationId, `Error triggering caption parser: ${error instanceof Error ? error.message : String(error)}`, 'ERROR', functionName);
        });
        
        // If this message is part of a media group, sync the caption changes to other messages in the group
        if (message.media_group_id) {
          logWithCorrelation(correlationId, `Caption changed for message in media group ${message.media_group_id}, syncing to other messages`, 'INFO', functionName);
          
          // Sync caption changes to other messages in the group
          syncMediaGroupCaptions(
            supabaseClient,
            message.media_group_id,
            dbResult.data.id,
            message.caption,
            captionData,
            'initialized', // Reset processing state for other messages
            correlationId
          ).catch(error => {
            logWithCorrelation(correlationId, `Error syncing media group captions: ${error instanceof Error ? error.message : String(error)}`, 'ERROR', functionName);
          });
        }
      }

    } catch (dbError) {
      // Handle schema mismatch errors gracefully
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      logWithCorrelation(correlationId, `Database schema error: ${errorMsg}`, 'ERROR', functionName);
      
      // Log the error
      await logProcessingEvent(
        supabaseClient,
        'media_message_db_schema_error',
        crypto.randomUUID(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error_type: dbError instanceof Error ? dbError.name : 'Unknown',
          error_details: errorMsg
        }
      );
      
      return createTelegramErrorResponse(
        `Database schema error: ${errorMsg}`,
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // Log success
    logWithCorrelation(correlationId, `Successfully processed message ${message.message_id}`, 'INFO', functionName);
    
    // Return success response with proper null/undefined checking
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processed successfully",
        messageId: dbResult?.data?.id || 'unknown',
        processingTime: Date.now() - new Date(message.date * 1000).getTime(),
        captionChanged,
        correlationId
      }),
      { status: 200 }
    );
  } catch (error) {
    // Handle error with comprehensive logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Error processing media message: ${errorMessage}`, 'ERROR', functionName);
    
    // Log the error
    await logProcessingEvent(
      supabaseClient,
      'media_message_processing_error',
      crypto.randomUUID(), // Generate a valid UUID instead of using 'N/A'
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id
      },
      errorMessage
    );
    
    return createErrorResponse(
      `Error processing media message: ${errorMessage}`,
      functionName,
      500,
      correlationId,
      { messageId: message.message_id, chatId: message.chat.id }
    );
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
  logWithCorrelation(correlationId, `Processing edited message ${message.message_id}`, 'INFO', functionName);
  
  try {
    // Check if media has changed by comparing file_unique_id
    const currentFileUniqueId = mediaContent.fileUniqueId;
    const hasNewMedia = currentFileUniqueId !== existingMessage.file_unique_id;
    
    // Check if caption has changed
    const captionChanged = message.caption !== existingMessage.caption;
    
    // If neither media nor caption changed, return early
    if (!hasNewMedia && !captionChanged) {
      logWithCorrelation(correlationId, `No changes detected in edited message ${message.message_id}`, 'INFO', functionName);
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
      message_data: message, // Update the complete message data
      is_edit: true          // Flag as edited message
    };
    
    // Update forward info if this is a forwarded message
    const forwardInfo = message.forward_date ? extractForwardInfo(message) : null;
    if (forwardInfo) {
      updates.forward_info = forwardInfo;
      updates.is_forward = true;
    }
    
    // If media has changed, process the new media
    if (hasNewMedia) {
      logWithCorrelation(correlationId, `Media changed in edited message ${message.message_id}`, 'INFO', functionName);
      
      // Process new media
      const processingResult = await mediaProcessor.processMedia(
        mediaContent,
        correlationId
      );
      
      let processingState = mapStatusToProcessingState(processingResult.status);
      logWithCorrelation(correlationId, `Media processing status for edited message ${message.message_id}: ${processingResult.status} -> DB state: ${processingState}`, 'INFO', functionName);
      
      // Update media fields
      if (processingResult.fileUniqueId) {
        updates.file_unique_id = processingResult.fileUniqueId;
        updates.storage_path = processingResult.storagePath;
        updates.public_url = processingResult.publicUrl;
        updates.mime_type = processingResult.mimeType;
        updates.extension = processingResult.extension;
        updates.processing_state = processingState;
        updates.processing_error = processingResult.error || null;
      }
    } else if (captionChanged) {
      // If only caption changed, reset processing state to trigger reprocessing
      updates.processing_state = 'initialized';
      
      // If the message has analyzed content, move it to old_analyzed_content
      if (existingMessage.analyzed_content) {
        updates.old_analyzed_content = existingMessage.old_analyzed_content 
          ? [...existingMessage.old_analyzed_content, existingMessage.analyzed_content]
          : [existingMessage.analyzed_content];
        updates.analyzed_content = captionData; // Set to captionData for consistency with media group sync
      }
    }
    
    // Update the message record
    const updateResult = await updateMessageRecord(
      supabaseClient,
      existingMessage,
      message,
      hasNewMedia ? { 
        fileUniqueId: updates.file_unique_id,
        storagePath: updates.storage_path,
        publicUrl: updates.publicUrl,
        mimeType: updates.mime_type,
        extension: updates.extension
      } : null,
      captionData,
      correlationId,
      updates // Pass all updates to ensure forward_info and other fields are properly updated
    );
    
    if (!updateResult) {
      logWithCorrelation(correlationId, `Failed to update message ${existingMessage.id}`, 'ERROR', functionName);
      return createTelegramErrorResponse(
        `Failed to update message`,
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // If caption has changed and this is part of a media group, sync the caption to other messages in the group
    if (captionChanged && message.media_group_id) {
      logWithCorrelation(correlationId, `Caption changed for message in media group ${message.media_group_id}, syncing to other messages`, 'INFO', functionName);
      
      // Sync caption changes to other messages in the group
      await syncMediaGroupCaptions(
        supabaseClient,
        message.media_group_id,
        existingMessage.id,
        message.caption,
        captionData,
        'initialized', // Reset processing state for other messages
        correlationId
      );
    }
    
    // If caption has changed, trigger the caption parser
    if (captionChanged && message.caption) {
      logWithCorrelation(correlationId, `Caption changed, triggering parser for message ${existingMessage.id}`, 'INFO', functionName);
      
      // Trigger caption parsing asynchronously
      triggerCaptionParsing({
        supabaseClient,
        messageId: existingMessage.id,
        correlationId
      }).catch(error => {
        logWithCorrelation(correlationId, `Error triggering caption parser: ${error instanceof Error ? error.message : String(error)}`, 'ERROR', functionName);
      });
    }
    
    // Log success
    logWithCorrelation(correlationId, `Successfully processed edited message ${message.message_id}`, 'INFO', functionName);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Edited message processed successfully",
        messageId: existingMessage.id,
        mediaChanged: hasNewMedia,
        captionChanged,
        correlationId
      }),
      { status: 200 }
    );
  } catch (error) {
    // Handle error with comprehensive logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Error processing edited media message: ${errorMessage}`, 'ERROR', functionName);
    
    // Log the error
    await logProcessingEvent(
      supabaseClient,
      'edited_media_message_processing_error',
      crypto.randomUUID(), // Generate a valid UUID instead of using 'N/A'
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id
      },
      errorMessage
    );
    
    return createErrorResponse(
      `Error processing edited media message: ${errorMessage}`,
      functionName,
      500,
      correlationId,
      { messageId: message.message_id, chatId: message.chat.id }
    );
  }
}

/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { supabaseClient } from "../../_shared/cors.ts";
import { handleError } from "../../_shared/ErrorHandler.ts";
import { MediaProcessor } from "../../_shared/MediaProcessor.ts";
import { createMediaProcessor } from "../../_shared/mediaUtils.ts";

// Error handling
import { createTelegramErrorResponse } from "../utils/errorUtils.ts";

// Local Imports
import {
  MessageContext,
  TelegramMessage,
} from '../types.ts';
import {
  extractForwardInfo,
  logProcessingEvent,
  syncMediaGroupCaptions,
  triggerCaptionParsing,
  upsertMediaMessageRecord
} from '../utils/dbOperations.ts';
import { logWithCorrelation } from '../utils/logger.ts';
import {
  checkMessageExists,
  extractMediaContent,
  processCaptionWithRetry
} from '../utils/messageUtils.ts';

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
 * Unified smart dispatcher handler for media messages
 * 
 * This handler consolidates the logic for processing all types of media messages:
 * 1. New media messages (first-time processing)
 * 2. Edited media messages (with edit_date from Telegram)
 * 3. Duplicate media messages with potentially new captions
 * 
 * The handler intelligently routes requests to the appropriate specialized functions
 * based on message context, mirroring our PostgreSQL smart_media_message_dispatcher.
 * 
 * @param telegramBotToken - The Telegram bot token for API access
 * @param message - The Telegram message to process
 * @param context - Context information including correlationId
 * @returns A Response object with the processing result
 */
export async function handleMediaMessage(
  telegramBotToken: string | null,
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  const functionName = 'handleMediaMessage';
  
  // Check if this is an edited message (critical for proper routing)
  const isEditedMessage = !!message.edit_date;
  
  // Log with edit status for better tracing
  logWithCorrelation(
    correlationId, 
    `Processing ${isEditedMessage ? 'edited' : 'new'} message ${message.message_id} in chat ${message.chat.id}`,
    'INFO', 
    functionName
  );
  
  try {
    // Validate required token parameter
    if (!telegramBotToken) {
      // Try as fallback to get directly from environment if parameter was not passed correctly
      const fallbackToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!fallbackToken) {
        throw new Error("TELEGRAM_BOT_TOKEN is not available");
      }
      // Use the fallback token instead
      telegramBotToken = fallbackToken;
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
    
    // Check if message already exists in database
    const { exists: messageExists, message: existingMessage } = await checkMessageExists(
      supabaseClient,
      message.message_id,
      message.chat.id,
      correlationId
    );
    
    // Process caption if present - this is needed for all message types
    const captionData = await processCaptionWithRetry(message.caption, correlationId);
    
    // Enhanced logging for dispatcher routing decisions
    logWithCorrelation(
      correlationId,
      `Message context: isEdited=${isEditedMessage}, existsInDB=${messageExists}, ` +
      `mediaGroupId=${message.media_group_id || 'none'}, hasCaption=${!!message.caption}`,
      'DEBUG',
      functionName
    );
    
    // Smart routing based on message context - mirrors our PostgreSQL dispatcher logic
    if (isEditedMessage) {
      // This is an explicit edit from Telegram (has edit_date)
      if (!messageExists) {
        // Edited message not found in database, treat as new but pass edit flag
        logWithCorrelation(
          correlationId, 
          `Edited message ${message.message_id} not found in database, treating as new but preserving edit flag`,
          'INFO', 
          functionName
        );
        return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId, true);
      } else {
        // Edited message found in database, update it
        return await handleEditedMessage(message, existingMessage, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
      }
    } else {
      // This is a new message (no edit_date)
      if (messageExists) {
        // Check if this might be a duplicate with changed caption that warrants processing
        if (message.caption !== existingMessage.caption) {
          logWithCorrelation(
            correlationId, 
            `Duplicate message ${message.message_id} has different caption. Old: "${existingMessage.caption}", New: "${message.caption}"`, 
            'INFO', 
            functionName
          );
          // Use handleNewMessage with existing data to properly handle caption update
          return await handleNewMessage(message, mediaContent, mediaProcessor, supabaseClient, captionData, correlationId);
        }
        
        // Message already exists in database with same caption, return existing record
        logWithCorrelation(correlationId, `Message ${message.message_id} already exists in database with same caption`, 'INFO', functionName);
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
        functionName,
        isEditedMessage  // Include edit status for better error tracking
      },
      supabaseClient
    });
    
    // Log the dispatching error to unified audit log
    await logProcessingEvent(
      supabaseClient,
      'media_message_dispatch_error',
      crypto.randomUUID(), 
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        is_edited: isEditedMessage,
        media_group_id: message.media_group_id || null,
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_details: error instanceof Error ? error.message : String(error)
      }
    );
    
    // Return standardized error response
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      functionName,
      500,
      correlationId,
      { 
        messageId: message.message_id, 
        chatId: message.chat.id,
        isEdited: isEditedMessage
      }
    );
  }
}

/**
 * Handles new media messages from Telegram
 * 
 * @param message - The Telegram message object
 * @param mediaContent - The extracted media content
 * @param mediaProcessor - The MediaProcessor instance
 * @param supabaseClient - The Supabase client for database operations
 * @param captionData - The processed caption data
 * @param correlationId - The correlation ID for request tracking
 * @param isExplicitEdit - Whether this is an explicit edit (has edit_date) but wasn't found in DB
 * @returns A Response object with the processing result
 */
async function handleNewMessage(
  message: TelegramMessage,
  mediaContent: any,
  mediaProcessor: MediaProcessor,
  supabaseClient: SupabaseClient,
  captionData: any,
  correlationId: string,
  isExplicitEdit: boolean = false
): Promise<Response> {
  const functionName = 'handleNewMessage';
  logWithCorrelation(correlationId, `Processing ${isExplicitEdit ? 'explicit edit (new to DB)' : 'new'} media message: ${message.message_id} in chat ${message.chat.id}`, 'INFO', functionName);

  try {
    // Get media type directly from mediaContent object
    const mediaType = mediaContent.mediaType;
    if (!mediaType) {
      throw new Error("Unsupported or missing media type");
    }
    
    // Process the media content and get storage information
    const processingResult = await mediaProcessor.processMedia(
      mediaContent,
      correlationId
    );
    
    // Map processing status to database state
    let processingState = mapStatusToProcessingState(processingResult.status);
    logWithCorrelation(
      correlationId, 
      `Media processing status: ${processingResult.status} -> DB state: ${processingState}`, 
      'INFO', 
      functionName
    );
    
    // Handle processing errors
    if (processingResult.status !== 'success' && processingResult.error) {
      logWithCorrelation(correlationId, `Media processing error: ${processingResult.error}`, 'ERROR', functionName);
      
      // Log the media processing error to audit log
      await logProcessingEvent(
        supabaseClient,
        'media_processing_error',
        crypto.randomUUID(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_type: mediaType,
          error_details: processingResult.error
        }
      );
      
      return createTelegramErrorResponse(
        `Media processing error: ${processingResult.error}`,
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // Handle forward info if present
    const forwardInfo = message.forward_date ? extractForwardInfo(message) : null;

    // Use the smart dispatcher pattern via upsertMediaMessageRecord
    const dbResult = await upsertMediaMessageRecord({
      supabaseClient,
      messageId: message.message_id,
      chatId: message.chat.id,
      caption: message.caption || null,
      mediaType,
      fileId: processingResult.fileId,
      fileUniqueId: processingResult.fileUniqueId,
      storagePath: processingResult.storagePath,
      publicUrl: processingResult.publicUrl,
      mimeType: processingResult.mimeType,
      extension: processingResult.extension,
      messageData: message as unknown as Json,
      processingState,
      processingError: processingResult.error,
      forwardInfo,
      mediaGroupId: message.media_group_id || null,
      captionData,                        // Processed caption data
      analyzedContent: captionData,       // Initialize analyzed_content with caption data
      oldAnalyzedContent: [],             // Explicitly initialize old_analyzed_content with empty array
      correlationId
    });
    
    if (!dbResult.success) {
      logWithCorrelation(correlationId, `Failed to create message record: ${dbResult.error}`, 'ERROR', functionName);
      return createTelegramErrorResponse(
        `Failed to create message record: ${dbResult.error}`,
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // Get the DB message ID from the result
    const messageDbId = dbResult.data?.id;
    if (!messageDbId) {
      logWithCorrelation(correlationId, "Message ID not returned from database", 'ERROR', functionName);
      return createTelegramErrorResponse(
        "Message ID not returned from database",
        functionName,
        500,
        correlationId,
        { messageId: message.message_id, chatId: message.chat.id }
      );
    }
    
    // Trigger caption parsing if a caption is present
    if (message.caption) {
      logWithCorrelation(correlationId, `Triggering caption parser for message ${messageDbId}`, 'INFO', functionName);
      
      try {
        // Process caption asynchronously
        const captionResult = await triggerCaptionParsing({
          supabaseClient,
          messageId: messageDbId,
          correlationId
        });
        
        if (!captionResult.success) {
          logWithCorrelation(
            correlationId, 
            `Warning: Caption parser trigger failed: ${captionResult.error}`, 
            'WARN', 
            functionName
          );
        }
      } catch (error) {
        // Log but don't fail the whole process
        logWithCorrelation(
          correlationId, 
          `Error triggering caption parser: ${error instanceof Error ? error.message : String(error)}`, 
          'ERROR', 
          functionName
        );
      }
    }
    
    // Trigger synchronization for media groups
    if (message.media_group_id) {
      logWithCorrelation(correlationId, `Message is part of media group ${message.media_group_id}, triggering sync`, 'INFO', functionName);
      
      try {
        // Synchronize media group messages - use syncMediaGroupCaptions from dbOperations
        const syncResult = await syncMediaGroupCaptions({
          supabaseClient,
          mediaGroupId: message.media_group_id,
          correlationId
        });
        
        if (!syncResult.success) {
          logWithCorrelation(
            correlationId, 
            `Warning: Media group sync trigger failed: ${syncResult.error}`, 
            'WARN', 
            functionName
          );
        }
      } catch (error) {
        // Log but don't fail the whole process
        logWithCorrelation(
          correlationId, 
          `Error triggering media group sync: ${error instanceof Error ? error.message : String(error)}`, 
          'ERROR', 
          functionName
        );
      }
    }
    
    // Log success with smart dispatcher context
    logWithCorrelation(
      correlationId, 
      `Successfully processed ${isExplicitEdit ? 'edited' : 'new'} media message ${message.message_id} via smart dispatcher`, 
      'INFO', 
      functionName
    );

    // Return comprehensive success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Media message processed successfully",
        messageId: messageDbId,
        mediaType,
        mediaGroupId: message.media_group_id || null,
        hasCaption: !!message.caption,
        isExplicitEdit,
        correlationId
      }),
      { status: 200 }
    );
  } catch (error) {
    // Handle error with comprehensive logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Error processing edited media message: ${errorMessage}`, 'ERROR', functionName);
    
    // Log the error with detailed context for the smart dispatcher
    await logProcessingEvent(
      supabaseClient,
      'edited_media_message_processing_error',
      crypto.randomUUID(),
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_group_id: message.media_group_id || null,
        error_type: error instanceof Error ? error.name : 'Unknown',
        has_edit_date: !!message.edit_date
      },
      errorMessage
    );
    
    return createErrorResponse(
      `Error processing edited media message: ${errorMessage}`,
      functionName,
      500,
      correlationId,
      { 
        messageId: message.message_id, 
        chatId: message.chat.id,
        mediaGroupId: message.media_group_id || null 
      }
    );
  }
}

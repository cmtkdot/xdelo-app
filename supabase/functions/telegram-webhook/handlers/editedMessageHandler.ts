import { supabaseClient } from '../../_shared/supabase.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { 
  xdelo_logProcessingEvent, 
  xdelo_updateMessage,
  xdelo_createMessage,
  LoggerInterface
} from '../../_shared/databaseOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/messageUtils.ts';
import { Logger } from '../../_shared/logger/index.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/edgeHandler.ts';

/**
 * Create a logger adapter that implements the LoggerInterface
 * This ensures we always have a valid logger even if the context logger is undefined
 */
function createLoggerAdapter(logger?: Logger): LoggerInterface {
  if (logger) {
    return {
      error: (message: string, error: unknown) => logger.error(message, error),
      info: (message: string, data?: unknown) => logger.info(message, data as Record<string, any>),
      warn: (message: string, data?: unknown) => logger.warn(message, data as Record<string, any>)
    };
  }
  
  // Fallback to console if no logger is provided
  return {
    error: (message: string, error: unknown) => console.error(message, error),
    info: (message: string, data?: unknown) => console.info(message, data),
    warn: (message: string, data?: unknown) => console.warn(message, data)
  };
}

/**
 * Handler for edited messages (text only - media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;
    const loggerAdapter = createLoggerAdapter(logger);
    
    // Check if it contains media - if so, delegate to media handler
    if (message.photo || message.video || message.document) {
      loggerAdapter.info(`Edited message ${message.message_id} contains media, will be handled by media handler`);
      throw new Error('Edited message contains media, should be handled by mediaMessageHandler');
    }
    
    loggerAdapter.info(`Processing edited text message ${message.message_id}`);
    
    // Find existing message
    const { data: existingMessage, error: lookupError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();
      
    if (lookupError && lookupError.code !== 'PGRST116') {
      // Error other than "not found"
      loggerAdapter.error(`Error looking up message for edit: ${lookupError.message}`);
      throw lookupError;
    }
    
    // Get message URL for reference
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    if (existingMessage) {
      loggerAdapter.info(`Found existing message ${existingMessage.id} for edit`);
      
      // Store previous state in edit_history
      const editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: existingMessage.text,
        new_text: message.text,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      // Prepare update data
      const updateData = {
        text: message.text,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        // If this is a text message, update these fields
        is_edited: true,
        telegram_data: message,
        correlation_id: correlationId
      };
      
      // Update the message using shared function
      const result = await xdelo_updateMessage(
        message.chat.id,
        message.message_id,
        updateData,
        loggerAdapter
      );
        
      if (!result.success) {
        loggerAdapter.error(`Error updating edited message: ${result.error_message}`);
        throw new Error(result.error_message || 'Failed to update message');
      }
      
      // Log the edit operation
      try {
        await xdelo_logProcessingEvent(
          "message_text_edited",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          }
        );
      } catch (logError) {
        loggerAdapter.error(`Error logging edit operation: ${logError instanceof Error ? logError.message : String(logError)}`);
      }
      
      return createSuccessResponse({ 
        success: true, 
        messageId: existingMessage.id, 
        correlationId,
        action: 'updated'
      });
    } else {
      loggerAdapter.info(`🆕 Original message not found, creating new record for edited message ${message.message_id}`);
      
      // If message not found, create a new record
      const isForward = isMessageForwarded(message);
      
      // Prepare message data
      const messageData = {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        text: message.text,
        is_edited: true,
        edit_count: 1,
        is_forward: isForward,
        correlation_id: correlationId,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        telegram_data: message,
        message_url: message_url,
        processing_state: 'initialized'
      };
      
      // Create a new message using shared function
      const result = await xdelo_createMessage(messageData, loggerAdapter);
      
      if (!result.success) {
        loggerAdapter.error(`Error creating new record for edited message: ${result.error_message}`);
        throw new Error(result.error_message || 'Failed to create message from edit');
      }
      
      loggerAdapter.info(`Created new message record ${result.id} for edited message ${message.message_id}`);
      
      // Log the operation
      try {
        await xdelo_logProcessingEvent(
          "message_created_from_edit",
          result.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          }
        );
      } catch (logError) {
        loggerAdapter.error(`Error logging message creation: ${logError instanceof Error ? logError.message : String(logError)}`);
      }
      
      return createSuccessResponse({ 
        success: true, 
        messageId: result.id, 
        correlationId,
        action: 'created'  
      });
    }
  } catch (error) {
    const loggerAdapter = createLoggerAdapter(context.logger);
    loggerAdapter.error(`Error processing edited message: ${error instanceof Error ? error.message : String(error)}`, { 
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    await xdelo_logProcessingEvent(
      "edited_message_processing_error",
      crypto.randomUUID().toString(),
      context.correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        original_entity_id: `${message.chat.id}_${message.message_id}`,
        error: error instanceof Error ? error.message : String(error)
      },
      error instanceof Error ? error.message : String(error)
    );
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error processing edited message',
      500,
      context.correlationId
    );
  }
}

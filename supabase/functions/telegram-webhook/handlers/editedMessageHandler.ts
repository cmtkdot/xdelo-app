
import { supabaseClient } from '../../_shared/supabase.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { 
  xdelo_logProcessingEvent, 
  xdelo_updateMessage,
  xdelo_createMessage,
  LoggerInterface
} from '../../_shared/databaseOperations.ts';
import { Logger } from '../../_shared/logger/index.ts';
import { createLoggerAdapter } from '../../_shared/logger/adapter.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/edgeHandler.ts';

/**
 * Check if a message is forwarded from another source
 */
function isMessageForwarded(message: any): boolean {
  if (!message) return false;
  
  // Check for standard forward fields
  if (message.forward_from || 
      message.forward_from_chat || 
      message.forward_date || 
      message.forward_signature || 
      message.forward_sender_name) {
    return true;
  }
  
  // Check for forwarded from channel posts which use forward_from_message_id
  if (message.forward_from_message_id) {
    return true;
  }
  
  return false;
}

/**
 * Handler for edited messages (text only - media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;
    const loggerAdapter = createLoggerAdapter(logger, correlationId);
    
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
    
    // Get message URL for reference - only do this once
    const { data: message_url, error: urlError } = await supabaseClient.rpc(
      'xdelo_construct_telegram_message_url',
      {
        chat_type: message.chat.type || 'unknown',
        chat_id: message.chat.id,
        id: message.message_id
      }
    );
    
    if (urlError) {
      loggerAdapter.warn('Error generating message URL', urlError);
    }
    
    // Now handle based on whether message exists
    if (existingMessage) {
      return await handleExistingMessageEdit(
        message, 
        existingMessage, 
        correlationId, 
        loggerAdapter
      );
    } else {
      return await handleNewMessageFromEdit(
        message, 
        isMessageForwarded(message), 
        message_url, 
        correlationId, 
        loggerAdapter
      );
    }
  } catch (error) {
    const loggerAdapter = createLoggerAdapter(context.logger, context.correlationId);
    loggerAdapter.error(`Error processing edited message: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log error with minimal data
    await xdelo_logProcessingEvent(
      "edited_message_processing_error",
      crypto.randomUUID().toString(),
      context.correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
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

/**
 * Handle updates for an existing message
 */
async function handleExistingMessageEdit(
  message: TelegramMessage, 
  existingMessage: any, 
  correlationId: string,
  logger: LoggerInterface
): Promise<Response> {
  logger.info(`Found existing message ${existingMessage.id} for edit`);
  
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
    logger
  );
    
  if (!result.success) {
    logger.error(`Error updating edited message: ${result.error_message}`);
    throw new Error(result.error_message || 'Failed to update message');
  }
  
  return createSuccessResponse({ 
    success: true, 
    messageId: existingMessage.id, 
    correlationId,
    action: 'updated'
  });
}

/**
 * Create a new message from an edit when original was not found
 */
async function handleNewMessageFromEdit(
  message: TelegramMessage, 
  isForward: boolean,
  message_url: string,
  correlationId: string,
  logger: LoggerInterface
): Promise<Response> {
  logger.info(`🆕 Original message not found, creating new record for edited message ${message.message_id}`);
  
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
  const result = await xdelo_createMessage(messageData, logger);
  
  if (!result.success) {
    logger.error(`Error creating new record for edited message: ${result.error_message}`);
    throw new Error(result.error_message || 'Failed to create message from edit');
  }
  
  logger.info(`Created new message record ${result.id} for edited message ${message.message_id}`);
  
  return createSuccessResponse({ 
    success: true, 
    messageId: result.id, 
    correlationId,
    action: 'created'  
  });
}

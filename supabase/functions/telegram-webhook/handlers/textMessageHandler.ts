import { supabaseClient } from '../../_shared/supabase.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent, xdelo_createNonMediaMessage, LoggerInterface } from '../../_shared/databaseOperations.ts';
import { Logger } from '../../_shared/logger/index.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/edgeHandler.ts';
import { corsHeaders } from '../../_shared/cors.ts';

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
 * Create a logger adapter that implements the LoggerInterface
 * This ensures we always have a valid logger even if the context logger is undefined
 */
function createLoggerAdapter(logger?: Logger, correlationId: string): LoggerInterface {
  if (logger) {
    return {
      error: (message: string, error: unknown): void => {
        logger.error(message, error);
      },
      info: (message: string, data?: unknown): void => {
        if (data) {
          logger.info(message, data as Record<string, any>);
        } else {
          logger.info(message);
        }
      },
      warn: (message: string, data?: unknown): void => {
        if (data) {
          logger.warn(message, data as Record<string, any>);
        } else {
          logger.warn(message);
        }
      }
    };
  }
  
  // Fallback to console if no logger is provided
  return {
    error: (message: string, error: unknown): void => console.error(message, error),
    info: (message: string, data?: unknown): void => console.info(message, data),
    warn: (message: string, data?: unknown): void => console.warn(message, data)
  };
}

/**
 * Handle a non-media message from Telegram
 */
export async function handleTextMessage(
  message: TelegramMessage,
  correlationId: string,
  context: MessageContext
): Promise<Response> {
  const loggerAdapter = createLoggerAdapter(context.logger, correlationId);
  
  try {
    // Check if message is valid
    if (!message || !message.chat || !message.message_id) {
      throw new Error('Invalid message format');
    }
    
    // Log the handling of a text message
    loggerAdapter.info('Processing text message', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      username: message.from?.username
    });
    
    // Extract info about forwarded messages
    const isForwarded = isMessageForwarded(message);
    
    let forwardInfo = null;
    if (isForwarded) {
      forwardInfo = {
        from_chat_id: message.forward_from_chat?.id,
        from_message_id: message.forward_from_message_id,
        from_user_id: message.forward_from?.id,
        forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : undefined,
        forward_signature: message.forward_signature,
        forward_sender_name: message.forward_sender_name
      };
    }
    
    // Generate message URL using database function
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
    
    // Prepare message data for database
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      text: message.text,
      message_type: 'text',
      from_user_id: message.from?.id,
      from_username: message.from?.username,
      correlation_id: correlationId,
      is_forward: isForwarded,
      is_edited: context.isEdit,
      forward_info: forwardInfo,
      media_group_id: message.media_group_id,
      telegram_data: message,
      message_url: message_url
    };
    
    // Save the text message to the database
    const result = await xdelo_createNonMediaMessage(messageData, loggerAdapter);
    
    if (!result.success) {
      throw new Error(result.error_message || 'Failed to create text message record');
    }
    
    // Log success
    loggerAdapter.info(`Successfully created new text message: ${result.id}`);
    
    return createSuccessResponse({ success: true, id: result.id, correlationId });
  } catch (error) {
    loggerAdapter.error('Error creating text message:', error);
    
    try {
      await xdelo_logProcessingEvent(
        "text_message_processing_failed",
        crypto.randomUUID(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        error instanceof Error ? error.message : String(error)
      );
    } catch (logError) {
      loggerAdapter.error('Failed to log error:', logError);
    }
    
    throw error;
  }
}
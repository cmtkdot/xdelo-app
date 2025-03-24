import { supabaseClient } from '../../_shared/supabase.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent, xdelo_createNonMediaMessage, LoggerInterface } from '../../_shared/databaseOperations.ts';
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

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger } = context;
    const loggerAdapter = createLoggerAdapter(logger);
    
    // Use the utility function to determine if message is forwarded
    const isForwarded = isMessageForwarded(message);
    
    // Log the start of message processing
    loggerAdapter.info(`📝 Processing non-media message ${message.message_id} in chat ${message.chat.id}`, {
      message_text: message.text ? `${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}` : null,
      message_type: isChannelPost ? 'channel_post' : 'message',
      is_forwarded: isForwarded,
    });
    
    // Generate message URL using our utility function
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    // Prepare message data
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      message_type: isChannelPost ? 'channel_post' : 'message',
      message_text: message.text || message.caption || '',
      telegram_data: message,
      processing_state: 'completed',
      is_forward: isForwarded,
      correlation_id: correlationId,
      message_url: message_url
    };
    
    // Create the message using shared function
    const result = await xdelo_createNonMediaMessage(
      messageData,
      loggerAdapter
    );
      
    if (!result.success) {
      loggerAdapter.error(`❌ Failed to store text message in database`, { error: result.error_message });
      throw new Error(result.error_message || 'Failed to create message');
    }
    
    // Log successful processing
    await xdelo_logProcessingEvent(
      "message_created",
      result.id,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: 'text',
        is_forward: isForwarded,
        message_url: message_url
      }
    );
    
    loggerAdapter.info(`✅ Successfully processed text message ${message.message_id}`, {
      message_id: message.message_id,
      db_id: result.id,
      message_url: message_url
    });
    
    return createSuccessResponse({ 
      success: true, 
      messageId: result.id, 
      correlationId,
      message_url: message_url 
    });
  } catch (error) {
    const loggerAdapter = createLoggerAdapter(context.logger);
    loggerAdapter.error(`❌ Error processing non-media message:`, { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      message_id: message.message_id
    });
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      crypto.randomUUID().toString(),
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'other_message'
      },
      error instanceof Error ? error.message : String(error)
    );
    
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      500,
      context.correlationId
    );
  }
}
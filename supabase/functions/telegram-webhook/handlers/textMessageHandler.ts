
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent, createNonMediaMessage } from '../dbOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded, extractTelegramMetadata } from '../../_shared/consolidatedMessageUtils.ts';

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger } = context;
    // Use the utility function to determine if message is forwarded
    const isForwarded = isMessageForwarded(message);
    
    // Log the start of message processing
    logger?.info(`📝 Processing non-media message ${message.message_id} in chat ${message.chat.id}`, {
      message_text: message.text ? `${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}` : null,
      message_type: isChannelPost ? 'channel_post' : 'message',
      is_forwarded: isForwarded,
    });
    
    // Generate message URL using consolidated utility function
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    // Extract essential telegram metadata instead of storing the entire telegram object
    const telegramMetadata = extractTelegramMetadata(message);
    
    // Create message record with optimized operation
    const { id: messageId, success, error } = await createNonMediaMessage({
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      message_type: isChannelPost ? 'channel_post' : 'message',
      message_text: message.text || message.caption || '',
      telegram_data: message,           // Still keep this for backward compatibility
      telegram_metadata: telegramMetadata, // Add the extracted metadata
      processing_state: 'completed',
      is_forward: isForwarded,
      correlation_id: correlationId,
      message_url: message_url
    });
      
    if (!success || !messageId) {
      logger?.error(`❌ Failed to store text message in database`, { error });
      throw new Error(error || 'Failed to create message record');
    }
    
    // Log successful processing
    await xdelo_logProcessingEvent(
      "message_created",
      messageId,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: 'text',
        is_forward: isForwarded,
        message_url: message_url
      }
    );
    
    logger?.success(`✅ Successfully processed text message ${message.message_id}`, {
      message_id: message.message_id,
      db_id: messageId,
      message_url: message_url
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId, 
        correlationId,
        message_url: message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    context.logger?.error(`❌ Error processing non-media message:`, { 
      error: error.message,
      stack: error.stack,
      message_id: message.message_id
    });
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'other_message'
      },
      error.message
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

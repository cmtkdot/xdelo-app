import { corsHeaders, addCorsHeaders } from '../utils/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../dbOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../utils/messageUtils.ts';
import { supabaseClient } from '../utils/supabase.ts';

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
    
    // Generate message URL using our utility function from utils/messageUtils.ts
    const message_url = constructTelegramMessageUrl(message);
    
    // Store message data in the other_messages table
    const { data, error } = await supabaseClient
      .from('other_messages')
      .insert({
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
        message_url: message_url, // Add the constructed URL
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      logger?.error(`❌ Failed to store text message in database`, { error });
      throw error;
    }
    
    // Log successful processing with string ID to avoid UUID type issues
    await xdelo_logProcessingEvent(
      "message_created",
      data.id.toString(), // Convert UUID to string to avoid type conflicts
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
      db_id: data.id,
      message_url: message_url
    });
    
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data.id, 
        correlationId,
        message_url: message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    ));
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
    
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    ));
  }
}

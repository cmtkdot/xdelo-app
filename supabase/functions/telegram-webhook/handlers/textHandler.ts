
import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { xdelo_logMessageError } from '../../_shared/messageLogger.ts';
import { TelegramMessage, MessageContext } from './mediaHandler.ts';

/**
 * Handle text/other messages (non-media)
 */
export async function handleTextMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  try {
    const { isChannelPost, isForwarded, correlationId } = context;
    
    // Store in other_messages table
    const { error } = await supabaseClient
      .from('other_messages')
      .insert([{
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: 'text',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: isForwarded,
        message_text: message.text || '',
        processing_state: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (error) throw error;

    console.log('Text message processed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling text message:', error);
    
    await xdelo_logMessageError(
      "unknown",
      `Text message handling error: ${error.message}`,
      context.correlationId,
      'message_create'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/messageUtils.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Handler for text messages and other non-media message types
 */
export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Generate the message URL
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    logger?.info(`Processing text message: ${message.message_id}`, { 
      chat_id: message.chat.id,
      message_url
    });
    
    // Check if this is a forwarded message
    const isForward = isMessageForwarded(message);
    if (isForward) {
      logger?.info(`Message ${message.message_id} is forwarded`);
    }
    
    // Create the message record
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        text: message.text,
        is_edited: !!message.edit_date,
        correlation_id: correlationId,
        telegram_data: message,
        is_forward: isForward,
        message_url: message_url
      })
      .select('id')
      .single();
      
    if (error) {
      logger?.error(`Error creating message record: ${error.message}`);
      throw error;
    }
    
    logger?.success(`Successfully created text message: ${data.id}`, { 
      telegram_message_id: message.message_id,
      message_url: message_url
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data.id, 
        correlationId,
        message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    context.logger?.error(`Error processing non-media message:`, { 
      error: error.message,
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    // Log the error
    try {
      await xdelo_logProcessingEvent(
        "message_processing_error",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: error.message,
          handler_type: 'text_message'
        },
        error.message
      );
    } catch (logError) {
      console.error('Error logging processing failure:', logError);
    }
    
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

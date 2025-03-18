
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';

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

const MAX_RETRY_COUNT = 5;

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, isForwarded, correlationId } = context;
    
    // Log the start of message processing
    console.log(`[${correlationId}] Processing non-media message ${message.message_id} in chat ${message.chat.id}`);
    
    // Extract text content from the message
    const messageText = message.text || message.caption || '';
    
    // Prepare forward info if applicable
    const forwardInfo = context.isForwarded ? extractForwardInfo(message) : null;
    
    // Store message data in the other_messages table
    const { data, error } = await supabaseClient
      .from('other_messages')
      .insert({
        // Use chat_id and message_id directly from the message object
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: isChannelPost ? 'channel_post' : 'message',
        message_text: messageText,
        telegram_data: message,
        telegram_message_id: message.message_id, // Explicitly add telegram_message_id field
        processing_state: 'completed',
        is_forward: context.isForwarded,
        forward_info: forwardInfo,
        correlation_id: correlationId,
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      throw error;
    }
    
    // Log successful processing
    await xdelo_logProcessingEvent(
      "message_created",
      data.id,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: 'text',
        is_forward: context.isForwarded
      }
    );
    
    console.log(`[${correlationId}] Successfully processed text message ${message.message_id}`);
    
    return new Response(
      JSON.stringify({ success: true, messageId: data.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error processing non-media message:`, error);
    
    try {
      // Get current retry count if message exists
      const { data: existingMessage } = await supabaseClient
        .from('other_messages')
        .select('id, retry_count')
        .eq('chat_id', message.chat.id)
        .eq('telegram_data->message_id', message.message_id)
        .maybeSingle();
      
      const retryCount = existingMessage?.retry_count || 0;
      
      // If we've already tried too many times, just store the raw data
      if (retryCount >= MAX_RETRY_COUNT) {
        console.log(`[${context.correlationId}] Max retry count reached for message ${message.message_id}, storing as raw data`);
        
        // Update if exists or insert new record with stored_only state
        if (existingMessage?.id) {
          await supabaseClient
            .from('other_messages')
            .update({
              telegram_data: message,
              processing_state: 'stored_only',
              retry_count: retryCount + 1,
              error_message: `Max retry count reached: ${error.message}`,
              last_error_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id);
        } else {
          // Create new record in stored_only state
          const { data: newRecord } = await supabaseClient
            .from('other_messages')
            .insert({
              chat_id: message.chat.id,
              chat_type: message.chat.type,
              chat_title: message.chat.title,
              message_type: message.channel_post ? 'channel_post' : 'message',
              message_text: message.text || message.caption || '',
              telegram_data: message,
              telegram_message_id: message.message_id, // Explicitly add telegram_message_id field
              processing_state: 'stored_only',
              is_forward: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
              forward_info: context.isForwarded ? extractForwardInfo(message) : null, // Extract forward info here too
              correlation_id: context.correlationId,
              retry_count: MAX_RETRY_COUNT,
              error_message: `Max retry count reached: ${error.message}`,
              last_error_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          // Log the fallback storage
          await xdelo_logProcessingEvent(
            "message_fallback_storage",
            newRecord?.data?.id || 'unknown',
            context.correlationId,
            {
              message_id: message.message_id,
              chat_id: message.chat.id,
              error_message: error.message,
              retry_count: MAX_RETRY_COUNT
            }
          );
        }
        
        // Return success to prevent Telegram from retrying
        return new Response(
          JSON.stringify({ 
            success: true, 
            fallback: true,
            message: "Stored message data without processing",
            correlationId: context.correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If we haven't reached max retries, update retry count or insert with error
      if (existingMessage?.id) {
        await supabaseClient
          .from('other_messages')
          .update({
            retry_count: retryCount + 1,
            error_message: error.message,
            last_error_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);
      } else {
        // Create a new record with error state
        await supabaseClient
          .from('other_messages')
          .insert({
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            message_type: message.channel_post ? 'channel_post' : 'message',
            message_text: message.text || message.caption || '',
            telegram_data: message,
            telegram_message_id: message.message_id, // Explicitly add telegram_message_id field
            processing_state: 'error',
            is_forward: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
            forward_info: context.isForwarded ? extractForwardInfo(message) : null, // Extract forward info here too
            correlation_id: context.correlationId,
            retry_count: 1,
            error_message: error.message,
            last_error_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (secondaryError) {
      console.error('Error during error handling:', secondaryError);
    }
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      "system",
      context.correlationId,
      {
        message_id: message.message_id,
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

// Helper function to extract forward info
function extractForwardInfo(message: TelegramMessage): Record<string, any> | null {
  if (!message.forward_from && !message.forward_from_chat && !message.forward_origin) {
    return null;
  }
  
  const forwardInfo: Record<string, any> = {
    is_forwarded: true
  };
  
  // Handle modern forward_origin data
  if (message.forward_origin) {
    forwardInfo.forward_origin_type = message.forward_origin.type;
    
    if (message.forward_origin.type === 'channel') {
      forwardInfo.forward_from_chat_id = message.forward_origin.chat?.id;
      forwardInfo.forward_from_chat_title = message.forward_origin.chat?.title;
      forwardInfo.forward_from_chat_type = message.forward_origin.chat?.type;
      forwardInfo.forward_from_message_id = message.forward_origin.message_id;
    } else if (message.forward_origin.type === 'user') {
      forwardInfo.forward_from_user_id = message.forward_origin.sender_user?.id;
    }
  }
  
  // Handle legacy forward fields
  if (message.forward_from) {
    forwardInfo.forward_from_user_id = message.forward_from.id;
    forwardInfo.forward_from_user_name = message.forward_from.first_name;
  }
  
  if (message.forward_from_chat) {
    forwardInfo.forward_from_chat_id = message.forward_from_chat.id;
    forwardInfo.forward_from_chat_title = message.forward_from_chat.title;
    forwardInfo.forward_from_chat_type = message.forward_from_chat.type;
  }
  
  if (message.forward_date) {
    forwardInfo.forward_date = new Date(message.forward_date * 1000).toISOString();
  }
  
  return forwardInfo;
}

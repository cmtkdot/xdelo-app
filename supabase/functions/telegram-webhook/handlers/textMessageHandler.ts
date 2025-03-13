
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';

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

export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      error_message: errorMessage,
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, isForwarded, correlationId } = context;
    
    // Log the start of message processing
    console.log(`[${correlationId}] Processing non-media message ${message.message_id} in chat ${message.chat.id}`);
    
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
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: 'text',
        is_forward: isForwarded
      }
    );
    
    console.log(`[${correlationId}] Successfully processed text message ${message.message_id}`);
    
    return new Response(
      JSON.stringify({ success: true, messageId: data.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error processing non-media message:`, error);
    
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

export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit } = context;
    
    if (!isEdit) {
      throw new Error('Invalid context for edited message handler');
    }
    
    console.log(`[${correlationId}] Processing edited message ${message.message_id} in chat ${message.chat.id}`);
    
    // Check if this has media
    if (message.photo || message.video || message.document) {
      // Import mediaMessageHandler dynamically to avoid circular dependencies
      const { handleMediaMessage } = await import('./mediaMessageHandler.ts');
      return await handleMediaMessage(message, context);
    }
    
    // Look up the original message in other_messages
    const { data: existingMessage } = await supabaseClient
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();
      
    if (existingMessage) {
      // Prepare edit history
      let editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: existingMessage.message_text,
        new_text: message.text || message.caption || '',
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      // Update the message
      const { error } = await supabaseClient
        .from('other_messages')
        .update({
          message_text: message.text || message.caption || '',
          telegram_data: message,
          updated_at: new Date().toISOString(),
          edit_history: editHistory,
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (error) {
        throw error;
      }
      
      // Log edit operation
      await xdelo_logProcessingEvent(
        "message_edited",
        existingMessage.id,
        correlationId,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          edit_type: 'text_message'
        }
      );
      
      console.log(`[${correlationId}] Successfully updated edited message ${message.message_id}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: existingMessage.id, 
          correlationId,
          action: 'updated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`[${correlationId}] Original message not found, creating new record`);
      
      // If original message not found, create a new one
      return await handleOtherMessage(message, {
        ...context,
        isEdit: false // Treat as a new message
      });
    }
  } catch (error) {
    console.error(`Error handling edited message:`, error);
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'edited_message'
      },
      error.message
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing edited message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

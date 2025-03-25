import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders, addCorsHeaders } from '../utils/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../dbOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../utils/messageUtils.ts';

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
 * Handler for edited messages (text only - media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;
    
    // Check if it contains media - if so, delegate to media handler
    if (message.photo || message.video || message.document) {
      logger?.info(`Edited message ${message.message_id} contains media, will be handled by media handler`);
      throw new Error('Edited message contains media, should be handled by mediaMessageHandler');
    }
    
    logger?.info(`Processing edited text message ${message.message_id}`);
    
    // Find existing message
    const { data: existingMessage, error: lookupError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();
      
    if (lookupError && lookupError.code !== 'PGRST116') {
      // Error other than "not found"
      logger?.error(`Error looking up message for edit: ${lookupError.message}`);
      throw lookupError;
    }
    
    // Get message URL for reference
    const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
    
    if (existingMessage) {
      logger?.info(`Found existing message ${existingMessage.id} for edit`);
      
      // Store previous state in edit_history
      const editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: existingMessage.text,
        new_text: message.text,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      // Prepare update data
      const messageData = {
        text: message.text,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        // If this is a text message, update these fields
        is_edited: true,
        telegram_data: message,
        updated_at: new Date().toISOString()
      };
      
      // Update the message
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id);
        
      if (updateError) {
        logger?.error(`Error updating edited message: ${updateError.message}`);
        throw updateError;
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
        logger?.error(`Error logging edit operation: ${logError.message}`);
      }
      
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
      logger?.info(`🆕 Original message not found, creating new record for edited message ${message.message_id}`);
      
      // If message not found, create a new record
      const isForward = isMessageForwarded(message);
      
      const { data, error: insertError } = await supabaseClient
        .from('messages')
        .insert({
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
          message_url: message_url
        })
        .select('id')
        .single();
        
      if (insertError) {
        logger?.error(`Error creating new record for edited message: ${insertError.message}`);
        throw insertError;
      }
      
      logger?.success(`Created new message record ${data.id} for edited message ${message.message_id}`);
      
      // Log the operation
      try {
        await xdelo_logProcessingEvent(
          "message_created_from_edit",
          data.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          }
        );
      } catch (logError) {
        logger?.error(`Error logging message creation: ${logError.message}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: data.id, 
          correlationId,
          action: 'created'  
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    logger?.error(`Error processing edited message: ${error.message}`, { 
      stack: error.stack,
      message_id: message.message_id
    });
    
    await xdelo_logProcessingEvent(
      "edit_processing_error",
      message.message_id.toString(),
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message,
        stack: error.stack
      },
      error.message
    );
    
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    ));
  }
}

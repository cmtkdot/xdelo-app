
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/messageUtils.ts';
import { createSupabaseClient } from '../../_shared/supabase.ts';

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
    
    // Generate message URL using our utility function
    const message_url = constructTelegramMessageUrl(message);
    
    // Create Supabase client
    const supabaseClient = createSupabaseClient();
    
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
          message_url: message_url, // Update the URL
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
          edit_type: 'text_message',
          message_url: message_url
        }
      );
      
      console.log(`[${correlationId}] Successfully updated edited message ${message.message_id}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: existingMessage.id, 
          correlationId,
          action: 'updated',
          message_url: message_url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`[${correlationId}] Original message not found, creating new record`);
      
      // If original message not found, create a new one
      const { handleOtherMessage } = await import('./textMessageHandler.ts');
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

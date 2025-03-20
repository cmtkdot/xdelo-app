import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders, handleOptionsRequest, createCorsResponse } from '../../_shared/cors.ts';
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

export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, logger } = context;
    
    if (!isEdit) {
      throw new Error('Invalid context for edited message handler');
    }
    
    logger?.info(`✏️ Processing edited message ${message.message_id} in chat ${message.chat.id}`, {
      has_caption: !!message.caption,
      caption_preview: message.caption ? `${message.caption.substring(0, 50)}${message.caption.length > 50 ? '...' : ''}` : null,
      edited_at: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
    });
    
    // Check if this has media
    if (message.photo || message.video || message.document) {
      // Import mediaMessageHandler dynamically to avoid circular dependencies
      const { handleMediaMessage } = await import('./mediaMessageHandler.ts');
      return await handleMediaMessage(message, context);
    }
    
    // Generate message URL using our utility function
    const message_url = constructTelegramMessageUrl(message);
    
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
      
      // Compare text to log what changed
      const previousText = existingMessage.message_text || '';
      const newText = message.text || message.caption || '';
      const textDifferent = previousText !== newText;
      
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: previousText,
        new_text: newText,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      // Log what changed
      if (textDifferent) {
        logger?.info(`📝 Message text changed in edit`, {
          previous_length: previousText.length,
          new_length: newText.length,
          previous_preview: previousText.substring(0, 30) + (previousText.length > 30 ? '...' : ''),
          new_preview: newText.substring(0, 30) + (newText.length > 30 ? '...' : '')
        });
      } else {
        logger?.info(`🔄 Message edited but text content unchanged`);
      }
      
      // Update the message
      const { error } = await supabaseClient
        .from('other_messages')
        .update({
          message_text: newText,
          telegram_data: message,
          message_url: message_url, // Update the URL
          updated_at: new Date().toISOString(),
          edit_history: editHistory,
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (error) {
        logger?.error(`❌ Failed to update edited message in database`, { error });
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
          message_url: message_url,
          text_changed: textDifferent
        }
      );
      
      logger?.success(`✅ Successfully updated edited message ${message.message_id}`, {
        message_id: message.message_id,
        db_id: existingMessage.id,
        edit_count: (existingMessage.edit_count || 0) + 1
      });
      
<<<<<<< HEAD
      return createCorsResponse({ 
        success: true, 
        messageId: existingMessage.id, 
        correlationId,
        action: 'updated'
      });
=======
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
>>>>>>> newmai
    } else {
      logger?.info(`🆕 Original message not found, creating new record for edited message ${message.message_id}`);
      
      // If original message not found, create a new one
      const { handleOtherMessage } = await import('./textMessageHandler.ts');
      return await handleOtherMessage(message, {
        ...context,
        isEdit: false // Treat as a new message
      });
    }
  } catch (error) {
    context.logger?.error(`❌ Error handling edited message:`, { 
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
        handler_type: 'edited_message'
      },
      error.message
    );
    
    return createCorsResponse({ 
      success: false, 
      error: error.message || 'Unknown error processing edited message',
      correlationId: context.correlationId
    }, { status: 500 });
  }
}

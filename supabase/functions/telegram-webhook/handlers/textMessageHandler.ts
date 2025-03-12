
import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { createNonMediaMessage } from '../dbOperations.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';

export async function xdelo_logMessageOperation(
  operationType: string,
  correlationId: string,
  metadata: Record<string, unknown>
) {
  return await xdelo_logProcessingEvent(
    `message_${operationType}`,
    metadata.telegram_message_id?.toString() || 'unknown',
    correlationId,
    metadata
  );
}

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, isForwarded, correlationId, isEdit } = context;
    
    const logger = {
      error: (message: string, error: unknown) => console.error(`[${correlationId}] ${message}`, error),
      info: (message: string, data?: unknown) => console.log(`[${correlationId}] ${message}`, data)
    };
    
    // Use createNonMediaMessage from dbOperations
    const result = await createNonMediaMessage(
      supabaseClient,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: isEdit ? 'edited_message' : 'message',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: isForwarded,
        message_text: message.caption || message.text || '',
        processing_state: 'completed',
        edit_count: 0,
        created_at: new Date().toISOString()
      },
      logger
    );

    if (!result.success) {
      throw new Error(result.error_message || 'Failed to create non-media message');
    }

    // Log success using standardized logging
    await xdelo_logMessageOperation('created', correlationId, {
      message_type: 'text',
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      is_forwarded: isForwarded,
      entity_id: result.id
    });

    console.log(`[${correlationId}] Text message ${message.message_id} processed successfully`);

    return new Response(
      JSON.stringify({ success: true, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error handling text message:`, error);
    
    // Log error using shared logging
    await xdelo_logProcessingEvent(
      'message_processing_failed',
      'unknown',
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'text_message'
      },
      error.message || 'Unknown error in text message handler'
    );
    
    return new Response(
      JSON.stringify({ error: error.message, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, previousMessage } = context;
    
    if (!previousMessage) {
      throw new Error('Previous message is required for editing');
    }
    
    // Check if message has media
    if (message.photo || message.video || message.document) {
      // Import dynamically to avoid circular dependencies
      const { handleMediaMessage } = await import('./mediaMessageHandler.ts');
      return await handleMediaMessage(message, { ...context, isEdit: true });
    }
    
    // Handle non-media edited message
    const { data: existingMessage } = await supabaseClient
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', previousMessage.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (existingMessage) {
      const messageText = message.caption || message.text || '';
      
      // Prepare edit history
      let editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: existingMessage.message_text,
        new_text: messageText,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      const { error } = await supabaseClient
        .from('other_messages')
        .update({
          message_text: messageText,
          is_edited: true,
          telegram_data: message,
          updated_at: new Date().toISOString(),
          correlation_id: context.correlationId,
          edit_history: editHistory,
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        })
        .eq('id', existingMessage.id);

      if (error) throw error;

      // Log the edit using standardized logging
      try {
        await xdelo_logMessageOperation(
          'edit',
          context.correlationId,
          {
            message: `Text message ${message.message_id} edited in chat ${message.chat.id}`,
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            entity_id: existingMessage.id,
            edit_type: 'text_edit'
          }
        );
      } catch (logError) {
        console.error('Error logging edit operation:', logError);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If we didn't find an existing message, treat it as a new message
    return await handleOtherMessage(message, context);
  } catch (error) {
    console.error('Error handling edited message:', error);
    
    // Log error using shared logging
    await xdelo_logProcessingEvent(
      'message_processing_failed',
      'unknown',
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'edited_message'
      },
      error.message || 'Unknown error in edited message handler'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

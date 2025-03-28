
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { constructTelegramMessageUrl, isMessageForwarded, logProcessingEvent } from '../../_shared/consolidatedMessageUtils.ts'; // Import logProcessingEvent
import { supabaseClient } from '../../_shared/supabase.ts'; // Import supabaseClient from its dedicated file

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
        is_edited: true,
        telegram_metadata: message, // Update metadata to the newer version
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
        await logProcessingEvent( // Use imported logProcessingEvent
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
          telegram_metadata: message,
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
        await logProcessingEvent( // Use imported logProcessingEvent
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
    context.logger?.error(`Error processing edited message: ${error.message}`, { stack: error.stack });

    await logProcessingEvent( // Use imported logProcessingEvent
      "edited_message_processing_error",
      `${message.chat.id}_${message.message_id}`,
      context.correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message
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

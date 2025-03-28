import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/consolidatedMessageUtils.ts'; // Only need these
import { logProcessingEvent } from '../../_shared/auditLogger.ts'; // Import from dedicated module
import { supabaseClient } from '../../_shared/supabase.ts'; // Import supabaseClient from its dedicated file

/**
 * Handler for edited messages (text only - media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;

    // Check if it contains media - if so, delegate to media handler
    if (message.photo || message.video || message.document) {
      logger?.info(`Edited message ${message.message_id} contains media, delegating to media handler.`);
      // Don't throw an error, just return a success response indicating it's delegated
      // The media handler will process it based on its own logic (which now includes edits)
       return new Response(
        JSON.stringify({
          success: true,
          message: `Edit for media message ${message.message_id} delegated to media handler.`,
          correlationId,
          action: 'delegated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger?.info(`Processing edited text message ${message.message_id}`);

    // Find existing message
    const { data: existingMessage, error: lookupError } = await supabaseClient
      .from('messages')
      .select('id') // Only need the ID to call the RPC
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
    const isChannelPost = message.sender_chat?.type === 'channel'; // Determine if it's a channel post edit

    if (existingMessage) {
      logger?.info(`Found existing message ${existingMessage.id} for edit`);

      // Call the RPC function to handle the edit
      const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('handle_message_edit', {
        p_message_id: existingMessage.id,
        p_telegram_message_id: message.message_id,
        p_chat_id: message.chat.id,
        p_new_text: message.text,
        p_new_caption: null, // No caption for text messages
        p_telegram_data: message, // Pass the full new message object as telegram_data
        p_is_channel_post: isChannelPost,
        p_edit_source: isChannelPost ? 'channel' : 'user' // Set source based on type
      });

      if (rpcError) {
        logger?.error(`Error calling handle_message_edit RPC: ${rpcError.message}`);
        throw rpcError;
      }

      if (rpcResult?.status !== 'success') {
         logger?.error(`RPC handle_message_edit failed: ${rpcResult?.message || 'Unknown RPC error'}`, { rpcResult });
         throw new Error(rpcResult?.message || 'Failed to update message via RPC');
      }

      logger?.success(`Successfully updated message ${existingMessage.id} via RPC`, { rpcResult });

      // Log the edit operation (optional, as the trigger handles history)
      try {
        await logProcessingEvent(
          "message_text_edited",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            edit_history_id: rpcResult?.edit_history_id // Log the history ID from RPC result
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
          action: 'updated',
          edit_history_id: rpcResult?.edit_history_id,
          edit_count: rpcResult?.edit_count
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // --- Logic for creating a new message if original is missing ---
      // This remains largely the same as the SQL functions don't cover this specific case
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
          is_edited: true, // Mark as edited
          edit_count: 1, // Initial edit count
          last_edit_at: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(), // Use edit_date if available
          last_edit_user_id: message.from?.id,
          is_channel_post: isChannelPost,
          edit_source: isChannelPost ? 'channel' : 'user',
          is_forward: isForward,
          correlation_id: correlationId,
          telegram_data: message, // Store the full message object
          message_url: message_url,
          processing_state: 'pending' // Needs processing (e.g., AI analysis)
        })
        .select('id')
        .single();

      if (insertError) {
        logger?.error(`Error creating new record for edited message: ${insertError.message}`);
        // Check for unique violation (race condition)
        if (insertError.code === '23505') { // Postgres unique violation code
           logger?.warn(`Race condition detected: Message ${message.message_id} likely inserted by another process. Skipping creation.`);
           // Attempt to find the message again to return its ID
           const { data: raceMessage, error: raceError } = await supabaseClient
             .from('messages')
             .select('id')
             .eq('telegram_message_id', message.message_id)
             .eq('chat_id', message.chat.id)
             .single();

           if (raceError || !raceMessage) {
             logger?.error(`Failed to find message after race condition: ${raceError?.message || 'Not found'}`);
             throw insertError; // Re-throw original error if lookup fails
           }
           // Return success indicating the message exists due to race condition resolution
           return new Response(
             JSON.stringify({
               success: true,
               messageId: raceMessage.id,
               correlationId,
               action: 'skipped_creation_race_condition'
             }),
             { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
        }
        throw insertError; // Re-throw other errors
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

    // Ensure message object exists for logging context
    const logMessageId = message?.message_id || 'unknown';
    const logChatId = message?.chat?.id || 'unknown';

    await logProcessingEvent(
      "edited_message_processing_error",
      `${logChatId}_${logMessageId}`, // Use safe identifiers
      context.correlationId,
      {
        message_id: logMessageId,
        chat_id: logChatId,
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

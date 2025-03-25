
import { TelegramMessage, MessageContext } from '../types.ts';
import { corsHeaders } from '../utils/cors.ts';
import { supabaseClient } from '../utils/supabase.ts';
import { xdelo_logProcessingEvent, xdelo_processCaptionFromWebhook, xdelo_syncMediaGroupFromWebhook } from '../utils/databaseOperations.ts';
import { handleMediaMessage } from './mediaMessageHandler.ts';
import { handleOtherMessage } from './textMessageHandler.ts';
import { prepareEditHistoryEntry } from '../utils/messageUtils.ts';

/**
 * Handle edited messages from Telegram
 * This handler is specifically for non-media edited messages
 * Media edits are handled by the mediaMessageHandler
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext) {
  const { logger } = context;
  
  // First, validate that this is not a media message - if it is, redirect to media handler
  if (message.photo || message.video || message.document) {
    logger?.warn('Edited message contains media, redirecting to mediaMessageHandler', {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type
    });
    
    // Log this routing correction for monitoring
    try {
      await xdelo_logProcessingEvent(
        'routing_correction',
        message.message_id.toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          original_handler: 'editedMessage',
          redirected_to: 'mediaMessage',
          reason: 'Message contains media but was routed to editedMessageHandler'
        }
      );
    } catch (logError) {
      console.error('Failed to log routing correction:', logError);
    }
    
    // Forward to the media handler
    return await handleMediaMessage(message, context);
  }
  
  logger?.info('Processing edited message', {
    message_id: message.message_id,
    chat_id: message.chat?.id,
    chat_type: message.chat?.type,
    edit_date: message.edit_date
  });

  try {
    // Check if this message exists in the other_messages table
    const { data: existingMessage, error: fetchError } = await supabaseClient
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Real error, not just "no rows returned"
      logger?.error('Error fetching existing message', {
        error: fetchError.message,
        message_id: message.message_id
      });
      
      throw new Error(`Failed to check for existing message: ${fetchError.message}`);
    }

    // If message exists, update it
    if (existingMessage) {
      logger?.info('Updating existing text message', {
        message_id: message.message_id,
        existing_id: existingMessage.id
      });

      // Prepare edit history
      const editHistory = existingMessage.edit_history || [];
      const previousContent = {
        message_text: existingMessage.message_text,
        edit_date: new Date().toISOString(),
        edit_source: 'telegram_edit'
      };
      editHistory.push(previousContent);

      // Update the message
      const { data: updatedMessage, error: updateError } = await supabaseClient
        .from('other_messages')
        .update({
          message_text: message.text,
          telegram_data: message,
          edit_history: editHistory,
          edit_count: (existingMessage.edit_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) {
        logger?.error('Error updating message', {
          error: updateError.message,
          message_id: message.message_id
        });
        
        throw new Error(`Failed to update message: ${updateError.message}`);
      }

      // Log the edit
      await xdelo_logProcessingEvent(
        'message_edited',
        existingMessage.id,
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat.id,
          edit_count: (existingMessage.edit_count || 0) + 1,
          previous_text: previousContent.message_text,
          new_text: message.text
        }
      );

      logger?.success('Successfully updated edited message', {
        message_id: message.message_id,
        entity_id: existingMessage.id
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Message updated successfully',
          id: existingMessage.id,
          correlationId: context.correlationId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // Message doesn't exist in other_messages, check if it exists in messages table
      const { data: existingMediaMessage, error: mediaFetchError } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .single();

      if (!mediaFetchError && existingMediaMessage) {
        // This was previously a media message that had its media removed
        // We should handle it as a special case
        logger?.info('Message was previously a media message, handling special case', {
          message_id: message.message_id,
          existing_id: existingMediaMessage.id
        });
        
        // Log this special case
        await xdelo_logProcessingEvent(
          'media_message_converted_to_text',
          existingMediaMessage.id,
          context.correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            previous_type: 'media',
            new_type: 'text'
          }
        );
        
        // Prepare edit history for the converted message
        const editHistory = existingMediaMessage.edit_history || [];
        editHistory.push({
          timestamp: new Date().toISOString(),
          edit_source: 'telegram_edit',
          change_type: 'media_removed',
          previous_file_id: existingMediaMessage.file_id,
          previous_file_unique_id: existingMediaMessage.file_unique_id,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        });
        
        // Create a new text message but preserve the editing history
        const { data: newTextMessage, error: createError } = await supabaseClient
          .from('other_messages')
          .insert({
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            message_type: 'edited_message',
            message_text: message.text || '',
            telegram_data: message,
            processing_state: 'completed',
            is_forward: context.isForwarded,
            correlation_id: context.correlationId,
            edit_history: editHistory,
            edit_count: (existingMediaMessage.edit_count || 0) + 1,
            converted_from_media: true,
            original_media_id: existingMediaMessage.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          logger?.error('Error creating converted text message', {
            error: createError.message,
            message_id: message.message_id
          });
          
          throw new Error(`Failed to create converted message: ${createError.message}`);
        }
        
        // Update the original media message to mark it as converted
        await supabaseClient
          .from('messages')
          .update({
            converted_to_text: true,
            converted_text_message_id: newTextMessage.id,
            edit_history: editHistory,
            edit_count: (existingMediaMessage.edit_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMediaMessage.id);
        
        logger?.success('Successfully converted media message to text', {
          message_id: message.message_id,
          original_media_id: existingMediaMessage.id,
          new_text_id: newTextMessage.id
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Media message converted to text successfully',
            id: newTextMessage.id,
            correlationId: context.correlationId
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Message doesn't exist in either table, treat as a new message
      logger?.info('Edited message not found in database, handling as new message', {
        message_id: message.message_id
      });
      
      // Handle as a new text message
      return await handleOtherMessage(message, context);
    }
  } catch (error) {
    logger?.error('Error processing edited message', {
      error: error.message,
      stack: error.stack,
      message_id: message.message_id
    });

    // Log the error
    await xdelo_logProcessingEvent(
      'edited_message_processing_error',
      message.message_id.toString(),
      context.correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message,
        stack: error.stack
      },
      error.message
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing edited message: ${error.message}`,
        correlationId: context.correlationId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent Telegram from retrying
      }
    );
  }
}

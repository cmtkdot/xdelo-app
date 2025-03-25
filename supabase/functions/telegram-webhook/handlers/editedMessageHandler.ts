
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/messageUtils.ts';
import { supabaseClient } from '../../_shared/supabase.ts';

/**
 * Handler for edited text messages (media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;
    
    // Double-check that this is not a media message
    if (message.photo || message.video || message.document) {
      logger?.warn(`Edited message ${message.message_id} contains media, will be redirected to media handler`);
      throw new Error('Edited message contains media, should be handled by mediaMessageHandler');
    }
    
    logger?.info(`Processing edited text message ${message.message_id}`);
    
    // Find existing message - using maybeSingle to avoid errors when no record is found
    const { data: existingMessage, error: lookupError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();
      
    if (lookupError) {
      logger?.error(`Error looking up message for edit: ${lookupError.message}`);
      throw lookupError;
    }
    
    // Check if we found the message
    if (!existingMessage) {
      logger?.info(`No existing message found for edit ${message.message_id}, creating new record`);
      return await createNewMessageFromEdit(message, correlationId, logger);
    }
    
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
  } catch (error) {
    context.logger?.error(`Error processing edited message: ${error.message}`, { stack: error.stack });
    
    // Create a safe entity ID for logging
    const safeEntityId = `chat_${message.chat.id}_msg_${message.message_id}`;
    
    await xdelo_logProcessingEvent(
      "edited_message_processing_error",
      safeEntityId,
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

/**
 * Helper function to create a new message record from an edited message
 */
async function createNewMessageFromEdit(message: TelegramMessage, correlationId: string, logger: any): Promise<Response> {
  logger?.info(`🆕 Creating new record for edited message ${message.message_id}`);
  
  // Get message URL for reference
  const message_url = constructTelegramMessageUrl(message.chat.id, message.message_id);
  
  // Check if this is a forwarded message
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

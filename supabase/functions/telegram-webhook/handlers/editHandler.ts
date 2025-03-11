
import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { xdelo_logMessageEdit, xdelo_logMessageError } from '../../_shared/messageLogger.ts';
import { TelegramMessage, MessageContext } from './mediaHandler.ts';
import { handleMediaMessage } from './mediaHandler.ts';
import { handleTextMessage } from './textHandler.ts';

/**
 * Handle edited messages (determines type and routes appropriately)
 */
export async function handleEditedMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  try {
    // Check if message has media
    if (message.photo || message.video || message.document || 
        message.animation || message.sticker || message.voice || message.audio) {
      // Handle as media message
      return await handleMediaMessage(message, context);
    }
    
    // Handle text edited message
    return await handleEditedTextMessage(message, context);
  } catch (error) {
    console.error('Error handling edited message:', error);
    
    await xdelo_logMessageError(
      "unknown",
      `Edited message handling error: ${error.message}`,
      context.correlationId,
      'message_edit'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle edited text messages
 */
async function handleEditedTextMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  const { correlationId, previousMessage } = context;
  
  if (!previousMessage) {
    // If no previous message found, treat as new message
    return await handleTextMessage(message, context);
  }
  
  // Find the existing message
  const { data: existingMessage } = await supabaseClient
    .from('other_messages')
    .select('*')
    .eq('telegram_message_id', previousMessage.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (existingMessage) {
    const messageText = message.text || '';
    
    // Prepare edit history
    let editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_text: existingMessage.message_text,
      new_text: messageText,
      edit_date: message.edit_date 
        ? new Date(message.edit_date * 1000).toISOString() 
        : new Date().toISOString()
    });
    
    // Update the existing message
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
        edit_date: message.edit_date 
          ? new Date(message.edit_date * 1000).toISOString() 
          : new Date().toISOString()
      })
      .eq('id', existingMessage.id);

    if (error) throw error;

    // Log the edit event
    await xdelo_logMessageEdit(
      existingMessage.id,
      message.message_id,
      message.chat.id,
      correlationId,
      'message_edit',
      {
        previous_text: existingMessage.message_text,
        new_text: messageText,
        update_type: 'text_edit'
      }
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If no existing message found, treat as new message
  return await handleTextMessage(message, context);
}

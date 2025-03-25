
import { supabaseClient } from '../utils/supabase.ts';
import { corsHeaders } from '../utils/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../utils/databaseOperations.ts';
import { constructTelegramMessageUrl, isMessageForwarded, prepareEditHistoryEntry } from '../utils/messageUtils.ts';

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger, isEdit, previousMessage } = context;
    // Use the utility function to determine if message is forwarded
    const isForwarded = isMessageForwarded(message);
    
    // Log the start of message processing
    logger?.info(`📝 Processing non-media message ${message.message_id} in chat ${message.chat.id}`, {
      message_text: message.text ? `${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}` : null,
      message_type: isChannelPost ? 'channel_post' : 'message',
      is_forwarded: isForwarded,
      is_edit: isEdit
    });
    
    // Generate message URL
    const message_url = constructTelegramMessageUrl(message);
    
    // If this is an edit, check if message exists
    if (isEdit) {
      const { data: existingMessage, error: fetchError } = await supabaseClient
        .from('other_messages')
        .select('*')
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .single();
        
      // If message exists, update it
      if (!fetchError && existingMessage) {
        logger?.info(`Updating existing text message ${message.message_id}`, {
          existing_id: existingMessage.id
        });
        
        // Prepare edit history
        const editHistory = existingMessage.edit_history || [];
        editHistory.push(prepareEditHistoryEntry(existingMessage, message, 'text'));
        
        // Update the message
        const { data: updatedMessage, error: updateError } = await supabaseClient
          .from('other_messages')
          .update({
            message_text: message.text,
            telegram_data: message,
            edit_history: editHistory,
            edit_count: (existingMessage.edit_count || 0) + 1,
            updated_at: new Date().toISOString(),
            edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
          })
          .eq('id', existingMessage.id)
          .select()
          .single();
          
        if (updateError) {
          logger?.error(`Error updating text message: ${updateError.message}`);
          throw new Error(`Failed to update message: ${updateError.message}`);
        }
        
        // Log the edit
        await xdelo_logProcessingEvent(
          'message_edited',
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            edit_count: (existingMessage.edit_count || 0) + 1,
            previous_text: editHistory[editHistory.length - 1].previous_text,
            new_text: message.text
          }
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Message updated successfully',
            id: existingMessage.id,
            correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if it was previously a media message
      const { data: existingMediaMessage, error: mediaFetchError } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .single();
        
      if (!mediaFetchError && existingMediaMessage) {
        logger?.info(`Message was previously a media message, now converted to text`, {
          message_id: message.message_id,
          media_id: existingMediaMessage.id
        });
        
        // Prepare edit history
        const editHistory = existingMediaMessage.edit_history || [];
        editHistory.push(prepareEditHistoryEntry(existingMediaMessage, message, 'media_to_text'));
        
        // Create a new text message with reference to the original media
        const { data: newTextMessage, error: createError } = await supabaseClient
          .from('other_messages')
          .insert({
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            message_type: isChannelPost ? 'channel_post' : 'message',
            message_text: message.text || '',
            telegram_data: message,
            processing_state: 'completed',
            is_forward: isForwarded,
            correlation_id: correlationId,
            message_url: message_url,
            converted_from_media: true,
            original_media_id: existingMediaMessage.id,
            edit_history: editHistory,
            edit_count: (existingMediaMessage.edit_count || 0) + 1,
            edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createError) {
          logger?.error(`Error creating converted text message: ${createError.message}`);
          throw new Error(`Failed to create converted message: ${createError.message}`);
        }
        
        // Update the media message to mark as converted
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
          
        // Log the conversion
        await xdelo_logProcessingEvent(
          'media_message_converted_to_text',
          existingMediaMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            previous_type: 'media',
            new_type: 'text',
            new_text_id: newTextMessage.id
          }
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Media message converted to text successfully',
            id: newTextMessage.id,
            correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // For new messages or if no existing message was found
    logger?.info(`Creating new text message for ${message.message_id}`);
    
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
        message_url: message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // If this is an edit without previous record, still create edit history
        edit_history: isEdit ? [{
          timestamp: new Date().toISOString(),
          is_initial_edit: true,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        }] : [],
        edit_count: isEdit ? 1 : 0
      })
      .select('id')
      .single();
      
    if (error) {
      logger?.error(`❌ Failed to store text message in database`, { error });
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
        is_forward: isForwarded,
        message_url: message_url,
        is_edit: isEdit
      }
    );
    
    logger?.success(`✅ Successfully processed text message ${message.message_id}`, {
      message_id: message.message_id,
      db_id: data.id,
      message_url: message_url
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data.id, 
        correlationId,
        message_url: message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    context.logger?.error(`❌ Error processing non-media message:`, { 
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

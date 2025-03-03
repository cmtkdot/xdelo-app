import { supabaseClient } from '../_shared/supabase.ts';
import { getMediaInfo } from './mediaUtils.ts';
import { logMessageOperation } from './logger.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  TelegramMessage, 
  MessageHandlerContext, 
  ForwardInfo,
  MessageInput,
  ProcessedMessageResult,
} from './types.ts';

interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
}

export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage } = context;
    const mediaInfo = await getMediaInfo(message);
    
    // Check if this is an edited message
    if (isEdit && previousMessage) {
      const { data: existingMessage } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('telegram_message_id', previousMessage.message_id)
        .eq('chat_id', message.chat.id)
        .single();

      if (existingMessage) {
        // Store previous state in edit_history
        let editHistory = existingMessage.edit_history || [];
        editHistory.push({
          timestamp: new Date().toISOString(),
          previous_caption: existingMessage.caption,
          new_caption: message.caption,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        });
        
        // Update the message with new caption and edit history
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            caption: message.caption,
            telegram_data: message,
            edit_date: new Date(message.edit_date * 1000).toISOString(),
            edit_history: editHistory,
            edit_count: (existingMessage.edit_count || 0) + 1,
            is_edited: true,
            correlation_id: correlationId,
            updated_at: new Date().toISOString(),
            // Reset processing state if caption changed
            processing_state: message.caption !== existingMessage.caption ? 'pending' : existingMessage.processing_state
          })
          .eq('id', existingMessage.id);

        if (updateError) throw updateError;

        // If caption changed, trigger parsing
        if (message.caption !== existingMessage.caption && message.caption) {
          try {
            // Call the parse-caption-with-ai function
            await supabaseClient.functions.invoke('parse-caption-with-ai', {
              body: {
                messageId: existingMessage.id,
                caption: message.caption,
                media_group_id: message.media_group_id,
                correlationId,
                isEdit: true
              }
            });
          } catch (analysisError) {
            console.error('Failed to trigger caption analysis for edited message:', analysisError);
            // Continue with the update regardless of analysis success
          }
        }

        // Log the edit event
        try {
          await logMessageOperation(
            'edit',
            context.correlationId,
            {
              message: `Message ${message.message_id} edited in chat ${message.chat.id}`,
              telegram_message_id: message.message_id,
              chat_id: message.chat.id,
              file_unique_id: mediaInfo.file_unique_id,
              existing_message_id: existingMessage.id,
              edit_type: message.caption !== existingMessage.caption ? 'caption_changed' : 'other_edit',
              media_group_id: message.media_group_id
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
    }

    // Handle new message or untracked edit
    
    // Prepare forward info if message is forwarded
    const forwardInfo: ForwardInfo | undefined = message.forward_origin ? {
      is_forwarded: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_chat_type: message.forward_origin.chat?.type,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
      original_chat_id: message.forward_origin.chat?.id,
      original_chat_title: message.forward_origin.chat?.title,
      original_message_id: message.forward_origin.message_id
    } : undefined;

    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      ...mediaInfo,
      correlation_id: context.correlationId,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
      is_forward: context.isForwarded,
      edit_history: isEdit ? [{
        timestamp: new Date().toISOString(),
        is_initial_edit: true,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      }] : []
    };

    // Insert the message into the database
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert([messageInput])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Log the insert event
    try {
      await logMessageOperation(
        'success',
        context.correlationId,
        {
          message: `New message ${message.message_id} created in chat ${message.chat.id}`,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaInfo.file_unique_id,
          media_group_id: message.media_group_id,
          is_forwarded: !!forwardInfo,
          forward_info: forwardInfo
        }
      );
    } catch (logError) {
      console.error('Error logging message operation:', logError);
    }

    // If message has caption, trigger immediate analysis
    if (message.caption && insertedMessage) {
      console.log(`Message ${insertedMessage.id} has caption, triggering immediate analysis`);
      
      try {
        // Call the parse-caption-with-ai function directly
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            messageId: insertedMessage.id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: context.correlationId,
            file_info: mediaInfo
          }
        });
      } catch (analysisError) {
        console.error('Failed to trigger caption analysis:', analysisError);
        // Don't throw here - we already stored the message, so let's continue
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error handling media message:', error);
    // Log error event
    try {
      await logMessageOperation(
        'error',
        context.correlationId,
        {
          message: 'Error handling media message',
          error_message: error.message, // Use error_message instead of error
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          error_code: error.code,
          processing_stage: 'media_handling'
        }
      );
    } catch (logError) {
      console.error('Error logging error operation:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),  // This is fine as it's just for the response
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

export const handleEditedMessage = async (message: TelegramMessage, context: MessageContext) => {
  try {
    const { correlationId, previousMessage } = context;
    
    if (!previousMessage) {
      throw new Error('Previous message is required for editing');
    }
    
    // Check if message has media
    if (message.photo || message.video || message.document) {
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
      const messageText = message.caption || '';
      
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

      try {
        await logMessageOperation(
          'edit',
          context.correlationId,
          {
            message: `Text message ${message.message_id} edited in chat ${message.chat.id}`,
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            existing_message_id: existingMessage.id,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

export const handleOtherMessage = async (message: TelegramMessage, context: MessageContext) => {
  try {
    const { isChannelPost, isForwarded, correlationId, isEdit } = context;
    
    // Store in other_messages table
    const { error } = await supabaseClient
      .from('other_messages')
      .insert([{
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        message_type: isEdit ? 'edited_message' : 'message',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: isForwarded,
        message_text: message.caption || '',
        processing_state: 'completed',
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;

    console.log('Webhook processing completed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling other message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

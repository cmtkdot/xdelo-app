
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
        const captionChanged = message.caption !== existingMessage.caption;
        
        // If this is an edit, use xdelo_handle_message_update function
        if (captionChanged) {
          const { data: updateResult, error: updateError } = await supabaseClient
            .rpc('xdelo_handle_message_update', {
              p_message_id: existingMessage.id,
              p_caption: message.caption,
              p_is_edit: true,
              p_correlation_id: correlationId
            });
            
          if (updateError) throw updateError;
        } else {
          // Just update telegram data if caption didn't change
          const { error: updateError } = await supabaseClient
            .from('messages')
            .update({
              telegram_data: message,
              edit_date: new Date(message.edit_date * 1000).toISOString(),
              edit_count: (existingMessage.edit_count || 0) + 1,
              is_edited: true,
              correlation_id: correlationId,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id);

          if (updateError) throw updateError;
        }

        // Log the edit event
        await logMessageOperation(
          'edit',
          context.correlationId,
          {
            message: `Message ${message.message_id} edited in chat ${message.chat.id}`,
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            file_unique_id: mediaInfo.file_unique_id,
            existing_message_id: existingMessage.id,
            edit_type: captionChanged ? 'caption_changed' : 'other_edit',
            media_group_id: message.media_group_id,
            previous_caption: existingMessage.caption,
            new_caption: message.caption
          }
        );

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for duplicate files
    const { data: duplicateCheck, error: duplicateError } = await supabaseClient
      .rpc('xdelo_handle_duplicate_detection', {
        p_file_unique_id: mediaInfo.file_unique_id,
        p_telegram_message_id: message.message_id,
        p_chat_id: message.chat.id,
        p_correlation_id: context.correlationId
      });
      
    if (duplicateError) {
      console.error('Error checking for duplicates:', duplicateError);
    }

    // If we found this is a duplicate of an existing message, update with forward info
    const isDuplicate = duplicateCheck?.is_duplicate;
    const originalMessageId = duplicateCheck?.original_message_id;
    
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

    // Create message input with additional fields for duplicates
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
      is_forward: isDuplicate,
      original_message_id: originalMessageId,
      forward_count: isDuplicate ? 1 : 0
    };

    // Insert the message into the database
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert([messageInput])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Log the insert event
    await logMessageOperation(
      'success',
      context.correlationId,
      {
        message: `New message ${message.message_id} created in chat ${message.chat.id}`,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        file_unique_id: mediaInfo.file_unique_id,
        media_group_id: message.media_group_id,
        is_forwarded: !!forwardInfo || isDuplicate,
        is_duplicate: isDuplicate,
        original_message_id: originalMessageId,
        forward_info: forwardInfo
      }
    );

    // If message has caption, trigger immediate analysis
    if (message.caption && insertedMessage) {
      console.log(`Message ${insertedMessage.id} has caption, triggering immediate analysis`);
      
      try {
        // Call the parse-caption-with-ai function directly
        const analysisResponse = await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            messageId: insertedMessage.id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: context.correlationId,
            file_info: mediaInfo
          }
        });
        
        if ('error' in analysisResponse) {
          console.error('Error from parse-caption-with-ai function:', analysisResponse.error);
        } else {
          console.log('Analysis triggered successfully');
        }
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
    await logMessageOperation(
      'error',
      context.correlationId,
      {
        message: 'Error handling media message',
        error: error.message,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        error_code: error.code,
        processing_stage: 'media_handling'
      }
    );
    return new Response(
      JSON.stringify({ error: error.message }),
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
        new_text: messageText
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
          edit_date: new Date().toISOString()
        })
        .eq('id', existingMessage.id);

      if (error) throw error;

      await logMessageOperation(
        'edit',
        context.correlationId,
        {
          message: `Text message ${message.message_id} edited in chat ${message.chat.id}`,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          existing_message_id: existingMessage.id,
          edit_type: 'text_edit',
          previous_text: existingMessage.message_text,
          new_text: messageText
        }
      );

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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

    // Check for duplicate message
    const isDuplicate = false; // TODO: Implement duplicate detection for non-media messages
    
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

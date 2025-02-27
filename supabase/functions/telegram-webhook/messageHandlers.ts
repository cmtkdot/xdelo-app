
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
        
        // Update the message
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            caption: message.caption,
            is_edited: true,
            correlation_id: correlationId,
            updated_at: new Date().toISOString(),
            // Reset processing state and analyzed content if caption changed
            processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
            analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
            group_caption_synced: captionChanged ? false : existingMessage.group_caption_synced,
            // Preserve existing storage path and public URL to prevent deletion
            storage_path: existingMessage.storage_path,
            public_url: existingMessage.public_url
          })
          .eq('id', existingMessage.id);

        if (updateError) throw updateError;

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

    // If not an edit, or if edited message not found, check if message with this file_unique_id exists
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', mediaInfo.file_unique_id)
      .eq('chat_id', message.chat.id)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (existingMessage) {
      // Message exists with same file_unique_id - handle as an update
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
        caption: message.caption,
        correlation_id: context.correlationId,
        updated_at: new Date().toISOString(),
        // Reset processing state and analyzed content if caption changed
        processing_state: message.caption !== existingMessage.caption ? 'pending' : existingMessage.processing_state,
        analyzed_content: message.caption !== existingMessage.caption ? null : existingMessage.analyzed_content,
        group_caption_synced: message.caption !== existingMessage.caption ? false : existingMessage.group_caption_synced,
        // Preserve existing storage path and public URL to prevent deletion
        storage_path: existingMessage.storage_path,
        public_url: existingMessage.public_url
        })
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      // Log the update event
      await logMessageOperation(
        'success',
        context.correlationId,
        {
          message: `Message ${message.message_id} updated in chat ${message.chat.id}`,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaInfo.file_unique_id,
          existing_message_id: existingMessage.id,
          update_type: 'caption_update',
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

    // No existing message - proceed with insert
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
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined
    };

    const { error: insertError } = await supabaseClient
      .from('messages')
      .insert([messageInput]);

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
        is_forwarded: !!forwardInfo,
        forward_info: forwardInfo
      }
    );

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
      
      const { error } = await supabaseClient
        .from('other_messages')
        .update({
          message_text: messageText,
          is_edited: true,
          telegram_data: message,
          updated_at: new Date().toISOString(),
          correlation_id: context.correlationId
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

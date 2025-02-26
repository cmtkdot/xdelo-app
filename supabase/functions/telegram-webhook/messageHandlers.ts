
import { supabase } from '../_shared/supabase.ts';
import { getMediaInfo } from './mediaUtils.ts';
import { xdelo_log_event } from './logger.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
}

export async function handleMediaMessage(message: any, correlationId: string) {
  try {
    const mediaInfo = await getMediaInfo(message);
    
    // First check if message with this file_unique_id exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', mediaInfo.file_unique_id)
      .eq('chat_id', message.chat.id)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (existingMessage) {
      // Message exists - handle as an update
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          caption: message.caption,
          correlation_id: correlationId,
          updated_at: new Date().toISOString(),
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          analyzed_content: message.caption ? null : existingMessage.analyzed_content,
          group_caption_synced: message.caption ? false : existingMessage.group_caption_synced
        })
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      // Log the update event
      await xdelo_log_event({
        event_type: 'message_updated',
        entity_id: existingMessage.id,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        previous_state: { caption: existingMessage.caption },
        new_state: { caption: message.caption },
        metadata: {
          update_type: 'caption_update',
          file_unique_id: mediaInfo.file_unique_id,
          media_group_id: message.media_group_id
        },
        correlation_id: correlationId
      });

      return;
    }

    // No existing message - proceed with insert
    const { error: insertError } = await supabase
      .from('messages')
      .insert([{
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        caption: message.caption,
        media_group_id: message.media_group_id,
        ...mediaInfo,
        correlation_id: correlationId,
        processing_state: message.caption ? 'pending' : 'initialized'
      }]);

    if (insertError) throw insertError;

    // Log the insert event
    await xdelo_log_event({
      event_type: 'message_created',
      entity_id: null,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      previous_state: null,
      new_state: { caption: message.caption },
      metadata: {
        file_unique_id: mediaInfo.file_unique_id,
        media_group_id: message.media_group_id
      },
      correlation_id: correlationId
    });

  } catch (error) {
    console.error('Error handling media message:', error);
    // Log error event
    await xdelo_log_event({
      event_type: 'message_processing_error',
      entity_id: null,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      error_message: error.message,
      metadata: {
        error_code: error.code,
        processing_stage: 'media_handling'
      },
      correlation_id: correlationId
    });
    throw error;
  }
}

export const handleOtherMessage = async (message: any, context: MessageContext) => {
  try {
    const { isChannelPost, isForwarded, correlationId, isEdit } = context;

    // Store in other_messages table
    const { error } = await supabase
      .from('other_messages')
      .insert([{
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        message_type: isEdit ? 'edited_message' : 'message',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: isForwarded,
        message_text: message.text,
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

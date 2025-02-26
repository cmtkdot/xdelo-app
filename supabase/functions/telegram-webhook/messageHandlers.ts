import { supabase } from '../_shared/supabase.ts';
import { getMediaInfo } from './mediaUtils.ts';
import { xdelo_log_event } from '../_shared/logger.ts';

export async function handleMediaMessage(message: any, correlationId: string) {
  try {
    const mediaInfo = await getMediaInfo(message);
    
    // Try to insert as new message first
    try {
      const { error } = await supabase
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

      // If no error, message was inserted normally
      if (!error) return;

      // If we get a uniqueness violation (23505)
      if (error.code === '23505') {
        // Get the original message
        const { data: originalMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('file_unique_id', mediaInfo.file_unique_id)
          .eq('deleted_from_telegram', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (!originalMessage) {
          throw new Error('Original message not found for forward');
        }

        // Insert as a forward
        const { error: forwardError } = await supabase
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
            is_forward: true,
            original_message_id: originalMessage.id,
            forward_from: message.forward_from,
            forward_from_chat: message.forward_from_chat,
            processing_state: 'pending'
          }]);

        if (forwardError) throw forwardError;
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Error handling media message:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error handling media message:', error);
    // Log error event
    await xdelo_log_event({
      event_type: 'message_processing_error',
      entity_id: message.message_id,
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
    const { isChannelPost, isForwarded, correlationId, isEdit } = context

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
      }])

    if (error) throw error

    console.log('Webhook processing completed successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error handling other message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

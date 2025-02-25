
import { serve } from "http/server";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { downloadAndStoreMedia } from './mediaUtils.ts';
import { getLogger } from './logger.ts';
import { TelegramMessage } from '../_shared/types.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  const logger = getLogger(correlationId);

  try {
    const update = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    logger.info('Received update', {
      has_new_message: !!update.message,
      has_channel_post: !!update.channel_post,
      has_edited_message: !!update.edited_message,
      has_edited_channel_post: !!update.edited_channel_post,
      correlation_id
    });

    // Check for duplicate message by unique identifiers
    const isDuplicate = async (messageId: number, chatId: number) => {
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('telegram_message_id', messageId)
        .eq('chat_id', chatId)
        .single();
      return !!existing;
    };

    // Handle edited messages (both regular and channel)
    if (update.edited_message || update.edited_channel_post) {
      const editedMessage = update.edited_message || update.edited_channel_post;
      const isChannelPost = !!update.edited_channel_post;
      
      logger.info('Processing edit', {
        message_id: editedMessage.message_id,
        chat_id: editedMessage.chat.id,
        is_channel_post: isChannelPost,
        correlation_id
      });

      // Process edit through dedicated handler
      const { error: editError } = await supabase.functions.invoke('handle-edited-channel-post', {
        body: {
          message_id: editedMessage.message_id,
          chat_id: editedMessage.chat.id,
          chat_type: isChannelPost ? 'channel' : editedMessage.chat.type,
          caption: editedMessage.caption || '',
          media_group_id: editedMessage.media_group_id,
          correlation_id,
          is_channel_post: isChannelPost
        }
      });

      if (editError) {
        logger.error('Edit handling failed', { error: editError, correlation_id });
        throw editError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'edit',
          is_channel_post: isChannelPost,
          correlation_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Handle new messages (both regular and channel posts)
    const message = update.message || update.channel_post;
    if (!message) {
      logger.info('No valid message found in update', { correlation_id });
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no valid message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Check for duplicate message
    const isDuplicateMessage = await isDuplicate(message.message_id, message.chat.id);
    if (isDuplicateMessage) {
      logger.info('Duplicate message detected', {
        message_id: message.message_id,
        chat_id: message.chat.id,
        correlation_id
      });
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'duplicate message',
          correlation_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Process new message with media
    if (message.photo || message.video) {
      const { success, publicUrl, error: uploadError } = await downloadAndStoreMedia(
        message as TelegramMessage,
        supabase,
        correlationId
      );

      if (!success || uploadError) {
        logger.error('Media upload failed', { error: uploadError, correlation_id });
        throw new Error(uploadError || 'Failed to upload media');
      }

      const baseMessageData = {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        caption: message.caption || '',
        media_group_id: message.media_group_id,
        public_url: publicUrl,
        processing_state: message.caption ? 'pending' : 'initialized',
        created_at: new Date().toISOString()
      };

      // Store the message
      const { error: insertError } = await supabase
        .from('messages')
        .insert([baseMessageData]);

      if (insertError) {
        logger.error('Failed to store message', { error: insertError, correlation_id });
        throw insertError;
      }

      // If message has caption, send for analysis
      if (message.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            message_id: message.message_id,
            caption: message.caption,
            correlation_id,
            media_group_id: message.media_group_id
          }
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'new_message',
          has_media: true,
          has_caption: !!message.caption,
          correlation_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Handle non-media messages
    logger.info('Processing non-media message', { 
      message_id: message.message_id,
      chat_id: message.chat.id,
      correlation_id 
    });

    const { error: textError } = await supabase
      .from('other_messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        message_text: message.text,
        created_at: new Date().toISOString(),
        correlation_id
      });

    if (textError) {
      logger.error('Failed to store text message', { error: textError, correlation_id });
      throw textError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: 'new_message',
        has_media: false,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlation_id: crypto.randomUUID()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

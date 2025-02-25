import { serve } from "http/server";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { downloadAndStoreMedia } from './mediaUtils.ts';
import { getLogger } from './logger.ts';

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

    // Handle edited channel posts
    if (update.edited_channel_post) {
      const editedMessage = update.edited_channel_post;
      
      logger.info('Processing edited channel post', {
        message_id: editedMessage.message_id,
        chat_id: editedMessage.chat.id,
        media_group_id: editedMessage.media_group_id
      });

      // Log the edit in unified_audit_logs
      await supabase.from('unified_audit_logs').insert({
        event_type: 'channel_post_edited',
        telegram_message_id: editedMessage.message_id,
        chat_id: editedMessage.chat.id,
        metadata: {
          media_group_id: editedMessage.media_group_id,
          new_caption: editedMessage.caption
        },
        correlation_id
      });

      // Call the specialized handler
      const response = await supabase.functions.invoke('handle-edited-channel-post', {
        body: {
          message_id: editedMessage.message_id,
          chat_id: editedMessage.chat.id,
          caption: editedMessage.caption || '',
          media_group_id: editedMessage.media_group_id,
          correlation_id
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          is_edited_channel_post: true,
          correlation_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Handle edited messages and channel posts
    if (update.edited_message || update.edited_channel_post) {
      const editedMessage = update.edited_message || update.edited_channel_post;
      const isChannelPost = !!update.edited_channel_post;
      
      logger.info('Received edited content', {
        is_channel_post: isChannelPost,
        has_media_group: !!editedMessage.media_group_id
      });

      const result = await handleEditedMessage(editedMessage, isChannelPost, correlationId);

      return new Response(
        JSON.stringify({
          success: result.success,
          correlation_id: correlationId,
          error: result.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Handle different message types
    const message = update.message || update.channel_post || 
                   update.edited_message || update.edited_channel_post;
    
    if (!message) {
      logger('No valid message found in update');
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no valid message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const isEdit = !!update.edited_message || !!update.edited_channel_post;
    const chat = message.chat;
    const mediaGroupId = message.media_group_id;
    
    // Check for media content
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    if (!media) {
      logger('No media, storing in other_messages');
      // Store text message in other_messages table
      const { error } = await supabase
        .from('other_messages')
        .insert({
          chat_id: chat.id,
          chat_type: chat.type,
          chat_title: chat.title,
          telegram_message_id: message.message_id,
          message_text: message.text,
          telegram_data: update,
          correlation_id: correlationId
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ status: 'success', type: 'text_message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    // Get media URL and upload to storage
    const telegramFileUrl = await downloadAndStoreMedia(media.file_id, media.file_unique_id, video ? video.mime_type : 'image/jpeg', correlationId);
    const storageUrl = telegramFileUrl;

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '',
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: storageUrl,
      storage_path: `${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update,
      correlation_id: correlationId,
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null
    };

    let resultMessage;

    if (existingMedia) {
      // Update existing record
      const { data: updated, error } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id)
        .select()
        .single();

      if (error) throw error;
      resultMessage = updated;

      // If this is an edit with changed caption, trigger reanalysis
      if (isEdit && message.caption !== existingMedia.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: existingMedia.id,
            caption: message.caption,
            correlation_id: correlationId,
            is_edit: true,
            media_group_id: mediaGroupId
          }
        });
      }
    } else {
      // Insert new record
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      resultMessage = inserted;

      // For new messages in a media group, check for existing analyzed content
      if (mediaGroupId) {
        const analyzedMessage = await findAnalyzedMessageInGroup(mediaGroupId);
        if (analyzedMessage?.analyzed_content) {
          await supabase
            .from('messages')
            .update({
              analyzed_content: analyzedMessage.analyzed_content,
              message_caption_id: analyzedMessage.id,
              is_original_caption: false,
              group_caption_synced: true,
              processing_state: 'completed'
            })
            .eq('id', resultMessage.id);
        }
      }

      // Trigger analysis for new messages with captions
      if (message.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: resultMessage.id,
            caption: message.caption,
            correlation_id: correlationId,
            media_group_id: mediaGroupId
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        correlation_id: correlationId,
        message: 'Message processed',
        messageId: resultMessage.id,
        isEdit,
        hasCaption: !!message.caption,
        mediaGroupId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    logger.error('Webhook error', { error });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

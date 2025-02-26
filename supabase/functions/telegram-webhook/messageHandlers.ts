
import { createClient } from "@supabase/supabase-js";
import { handleError } from "../_shared/baseHandler.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { Message, ProcessingState } from "../_shared/types.ts";

interface HandlerContext {
  supabaseClient: ReturnType<typeof createClient>;
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
  correlationId: string;
  botToken: string;
}

export async function handleMessage(update: any, context: HandlerContext) {
  const { supabaseClient, logger, correlationId } = context;
  
  // Handle both regular messages, channel posts, and edited channel posts
  const message = update.message || update.channel_post || update.edited_channel_post;
  const isEdit = !!update.edited_channel_post;

  if (!message) {
    return { status: 'skipped', reason: 'no message content' };
  }

  try {
    // Extract forwarding information
    const forwardInfo = message.forward_origin || message.forward_from_chat ? {
      is_forwarded: true,
      forward_origin_type: message.forward_origin?.type,
      forward_from_chat_id: message.forward_from_chat?.id,
      forward_from_chat_title: message.forward_from_chat?.title,
      forward_from_chat_type: message.forward_from_chat?.type,
      forward_from_message_id: message.forward_from_message_id,
      forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : null,
      original_chat_id: message.forward_origin?.chat?.id,
      original_chat_title: message.forward_origin?.chat?.title,
      original_message_id: message.forward_origin?.message_id
    } : null;

    // Handle media messages (photos, videos, etc.)
    if (message.photo || message.video) {
      const media = message.photo ? message.photo[message.photo.length - 1] : message.video;
      const caption = message.caption;
      const mediaGroupId = message.media_group_id;

      // Base message data
      const messageData = {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        media_group_id: mediaGroupId,
        caption: caption,
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: message.video ? message.video.mime_type : 'image/jpeg',
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: message.video?.duration,
        telegram_data: message,
        processing_state: 'pending' as ProcessingState,
        correlation_id: correlationId,
        forward_info: forwardInfo,
        is_edited_channel_post: isEdit,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null
      };

      logger.info('Processing message:', {
        messageId: message.message_id,
        isEdit,
        isForwarded: !!forwardInfo,
        mediaGroupId
      });

      if (isEdit) {
        // Update existing message
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update(messageData)
          .eq('chat_id', message.chat.id)
          .eq('telegram_message_id', message.message_id);

        if (updateError) throw updateError;
      } else {
        // Insert new message
        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert(messageData);

        if (insertError) throw insertError;
      }

      // Always trigger analysis for new or edited messages
      try {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: message.message_id,
            caption: caption,
            media_group_id: mediaGroupId,
            is_edit: isEdit,
            is_forward: !!forwardInfo
          }
        });
      } catch (error) {
        logger.error('Error triggering caption analysis:', error);
      }

      return {
        status: 'success',
        message_id: message.message_id,
        media_group_id: mediaGroupId,
        is_edit: isEdit,
        is_forwarded: !!forwardInfo
      };
    }

    return { status: 'skipped', reason: 'not a media message' };

  } catch (error) {
    logger.error('Error in handleMessage:', error);
    return handleError(error);
  }
}

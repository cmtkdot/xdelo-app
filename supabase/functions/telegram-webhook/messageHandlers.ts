
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
  const message = update.message || update.channel_post;

  if (!message) {
    return { status: 'skipped', reason: 'no message content' };
  }

  try {
    // Extract forwarding information
    const forwardInfo = {
      is_forwarded: !!message.forward_origin,
      forward_origin_type: message.forward_origin?.type,
      forward_from_chat_id: message.forward_from_chat?.id,
      forward_from_chat_title: message.forward_from_chat?.title,
      forward_from_chat_type: message.forward_from_chat?.type,
      forward_from_message_id: message.forward_from_message_id,
      forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : null,
      original_chat_id: message.forward_origin?.chat?.id,
      original_chat_title: message.forward_origin?.chat?.title,
      original_message_id: message.forward_origin?.message_id,
    };

    // Handle media messages (photos, videos, etc.)
    if (message.photo || message.video) {
      const media = message.photo ? message.photo[message.photo.length - 1] : message.video;
      const caption = message.caption;
      const mediaGroupId = message.media_group_id;

      // If this is a forwarded message, try to get the original message's analyzed content
      let originalAnalyzedContent = null;
      if (forwardInfo.is_forwarded && forwardInfo.original_chat_id && forwardInfo.original_message_id) {
        const { data: originalMessage } = await supabaseClient
          .from('messages')
          .select('analyzed_content')
          .eq('chat_id', forwardInfo.original_chat_id)
          .eq('telegram_message_id', forwardInfo.original_message_id)
          .single();

        if (originalMessage?.analyzed_content) {
          originalAnalyzedContent = originalMessage.analyzed_content;
        }
      }

      // Prepare the message data
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
        processing_state: originalAnalyzedContent ? 'completed' as ProcessingState : 'pending' as ProcessingState,
        correlation_id: correlationId,
        // Forward-specific fields
        ...forwardInfo,
        // If we have the original analyzed content, use it
        analyzed_content: originalAnalyzedContent,
        processing_completed_at: originalAnalyzedContent ? new Date().toISOString() : null
      };

      logger.info('Inserting message with data:', { 
        messageId: message.message_id, 
        mediaGroupId, 
        isForwarded: forwardInfo.is_forwarded,
        hasOriginalContent: !!originalAnalyzedContent 
      });

      const { error: insertError } = await supabaseClient
        .from('messages')
        .insert(messageData);

      if (insertError) {
        throw insertError;
      }

      // If we don't have analyzed content and there's a caption, trigger analysis
      if (!originalAnalyzedContent && caption) {
        try {
          await supabaseClient.functions.invoke('parse-caption-with-ai', {
            body: { 
              messageId: message.message_id,
              caption: caption,
              media_group_id: mediaGroupId,
              is_forward: forwardInfo.is_forwarded
            }
          });
        } catch (error) {
          logger.error('Error triggering caption analysis:', error);
        }
      }

      return {
        status: 'success',
        message_id: message.message_id,
        media_group_id: mediaGroupId,
        is_forwarded: forwardInfo.is_forwarded,
        has_original_content: !!originalAnalyzedContent
      };
    }

    // Handle non-media messages
    return { status: 'skipped', reason: 'not a media message' };

  } catch (error) {
    logger.error('Error in handleMessage:', error);
    return handleError(error);
  }
}

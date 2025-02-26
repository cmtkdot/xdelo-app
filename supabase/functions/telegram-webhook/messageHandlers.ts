import { TelegramMessage, TelegramContext, Message } from "./types.ts";
import { uploadMediaToStorage } from "./mediaUtils.ts";
import { ProcessingState } from "../_shared/types.ts";
import { createMessage } from "./dbOperations.ts";

export async function handleMessage(update: any, context: TelegramContext) {
  const { supabaseClient, logger, correlationId, botToken } = context;
  const message = update.message || update.channel_post;

  try {
    // Handle media messages (photos or videos)
    if (message.photo || message.video) {
      return await handleMediaMessage(message, context);
    }

    // Handle other types of messages
    return await handleNonMediaMessage(message, context);
  } catch (error) {
    logger.error('Error in handleMessage:', error);
    throw error;
  }
}

async function handleMediaMessage(message: TelegramMessage, context: TelegramContext) {
  const { supabaseClient, logger, correlationId } = context;

  try {
    const media = message.photo ? message.photo[message.photo.length - 1] : message.video;
    if (!media) throw new Error('No media found in message');

    // Check for existing message with same file_unique_id
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    if (existingMessage) {
      logger.info('Found existing message with same file_unique_id, handling duplicate', {
        existing_id: existingMessage.id,
        file_unique_id: media.file_unique_id
      });

      // Store old analyzed content
      const old_analyzed_content = existingMessage.old_analyzed_content || [];
      if (existingMessage.analyzed_content) {
        old_analyzed_content.push(existingMessage.analyzed_content);
      }

      try {
        // Re-upload media to get new URL
        const { public_url, storage_path } = await uploadMediaToStorage(
          media.file_id,
          context,
          media.file_unique_id + '_forwarded_' + Date.now()
        );

        // Update existing message with new data
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            media_group_id: message.media_group_id,
            caption: message.caption,
            public_url,
            processing_state: 'pending' as ProcessingState,
            old_analyzed_content,
            analyzed_content: null,
            processing_started_at: null,
            processing_completed_at: null,
            group_caption_synced: false,
            telegram_data: message,
            error_message: null,
            forward_info: message.forward_from_chat ? {
              from_chat_id: message.forward_from_chat.id,
              from_message_id: message.forward_from_message_id,
              from_chat_title: message.forward_from_chat.title,
              forward_date: new Date(message.forward_date * 1000).toISOString()
            } : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);

        if (updateError) throw updateError;

        logger.info('Successfully updated existing message for forwarded content', {
          message_id: existingMessage.id,
          new_telegram_id: message.message_id
        });

        return {
          success: true,
          message: 'Updated existing message with forwarded content',
          id: existingMessage.id
        };
      } catch (error) {
        logger.error('Error handling duplicate message:', error);
        throw error;
      }
    }

    // If no existing message, proceed with normal message creation
    const { public_url, storage_path } = await uploadMediaToStorage(media.file_id, context, media.file_unique_id);

    const messageData = {
      telegram_message_id: message.message_id,
      media_group_id: message.media_group_id,
      message_caption_id: null,
      is_original_caption: true,
      group_caption_synced: false,
      caption: message.caption,
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: public_url,
      mime_type: message.photo ? 'image/jpeg' : 'video/mp4',
      file_size: message.photo ? media.file_size : media.file_size,
      width: message.photo ? media.width : message.video?.width,
      height: message.photo ? media.height : message.video?.height,
      duration: message.video?.duration,
      user_id: String(message.from?.id),
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      telegram_data: message,
      correlation_id: correlationId,
      forward_info: message.forward_from_chat ? {
        from_chat_id: message.forward_from_chat.id,
        from_message_id: message.forward_from_message_id,
        from_chat_title: message.forward_from_chat.title,
        forward_date: new Date(message.forward_date * 1000).toISOString()
      } : null
    };

    const { id, success, error } = await createMessage(supabaseClient, messageData, logger);

    if (!success) {
      logger.error('Error creating message:', error);
      throw new Error(error);
    }

    return {
      success: true,
      message: 'Message created successfully',
      id: id
    };

  } catch (error) {
    logger.error('Error in handleMediaMessage:', error);
    throw error;
  }
}

async function handleNonMediaMessage(message: TelegramMessage, context: TelegramContext) {
  const { supabaseClient, logger, correlationId } = context;

  try {
    // Implement logic to handle non-media messages
    logger.info('Handling non-media message', { message });

    // Example: Save text messages to a different table
    const { data, error } = await supabaseClient
      .from('other_messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        user_id: String(message.from?.id),
        message_type: 'text', // Define message type
        message_text: message.text, // Save text content
        telegram_data: message,
        correlation_id: correlationId
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving non-media message:', error);
      throw error;
    }

    return {
      success: true,
      message: 'Non-media message saved successfully',
      id: data.id
    };
  } catch (error) {
    logger.error('Error in handleNonMediaMessage:', error);
    throw error;
  }
}

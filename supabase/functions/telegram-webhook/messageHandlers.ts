import { SupabaseClient } from "@supabase/supabase-js";
import { TelegramMessage } from "./types";
import { getLogger } from "./logger";
import { downloadAndStoreMedia } from "./mediaUtils";

export async function handleEditedMessage(
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Processing edited message', {
      message_id: message.message_id,
      chat_id: message.chat.id
    });

    // Find existing message
    const { data: existingMessage, error: findError } = await supabase
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (findError || !existingMessage) {
      logger.error('Could not find original message', { error: findError });
      throw new Error('Original message not found');
    }

    // Check if caption actually changed
    const currentCaption = message.caption || '';
    const previousCaption = existingMessage.caption || '';
    const captionChanged = currentCaption !== previousCaption;

    // Prepare edit history entry
    const editHistoryEntry = {
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      previous_caption: previousCaption,
      new_caption: currentCaption,
      is_channel_post: true
    };

    // Update message with new data
    const updates: any = {
      is_edited: true,
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      edit_history: existingMessage.edit_history 
        ? [...existingMessage.edit_history, editHistoryEntry]
        : [editHistoryEntry],
      telegram_data: {
        original_message: existingMessage.telegram_data?.message || existingMessage.telegram_data,
        edited_message: message
      },
      caption: currentCaption,
      updated_at: new Date().toISOString()
    };

    // If caption changed, reset analysis state
    if (captionChanged) {
      logger.info('Caption changed, resetting analysis state', {
        message_id: existingMessage.id,
        previous: previousCaption,
        new: currentCaption
      });
      
      updates.analyzed_content = null;
      updates.processing_state = 'pending';
      
      // If this is part of a media group and is the caption holder
      if (existingMessage.media_group_id && existingMessage.is_original_caption) {
        // Reset group synchronization
        updates.group_caption_synced = false;
        
        // Update other messages in the group to reset their synced content
        await supabase
          .from('messages')
          .update({
            analyzed_content: null,
            processing_state: 'pending',
            group_caption_synced: false,
            updated_at: new Date().toISOString()
          })
          .eq('media_group_id', existingMessage.media_group_id)
          .neq('id', existingMessage.id);
      }
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', existingMessage.id);

    if (updateError) {
      logger.error('Failed to update edited message', { error: updateError });
      throw updateError;
    }

    // If caption changed, trigger reanalysis
    if (captionChanged) {
      logger.info('Triggering reanalysis for edited message');
      
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: {
          message_id: existingMessage.id,
          caption: currentCaption,
          correlation_id: correlationId,
          is_edit: true,
          media_group_id: existingMessage.media_group_id
        }
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('Error handling edited message', { error });
    return { 
      success: false,
      error: error.message
    };
  }
}

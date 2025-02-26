
import { corsHeaders } from "../_shared/cors.ts";
import { SupabaseClient } from "@supabase/supabase-js";
import { logMessageOperation } from "./logger.ts";

interface MessageData {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  media_group_id?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    mime_type?: string;
  };
}

export const handleMessage = async (
  supabase: SupabaseClient,
  messageData: MessageData,
  correlationId: string
) => {
  try {
    const { message_id, chat, media_group_id, caption } = messageData;
    const media = messageData.photo?.[messageData.photo.length - 1] || messageData.video;

    // If there's no media in an edited message, just update caption
    if (!media && messageData.edit_date) {
      await logMessageOperation('edit', correlationId, {
        message: 'Edited message without media, updating caption only',
        telegram_message_id: message_id,
        chat_id: chat.id
      });

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          caption,
          is_edited: true,
          edit_date: new Date().toISOString(),
          processing_state: 'pending'
        })
        .eq('telegram_message_id', message_id)
        .eq('chat_id', chat.id);

      if (updateError) {
        console.error('Error updating caption:', updateError);
      }
      return;
    }

    // Handle cases without media
    if (!media) {
      await logMessageOperation('skip', correlationId, {
        message: 'Message contains no media, skipping',
        telegram_message_id: message_id
      });
      return;
    }

    // Check for existing message with same file_unique_id
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, telegram_message_id, chat_id, file_unique_id, analyzed_content')
      .eq('file_unique_id', media.file_unique_id)
      .maybeSingle();

    // If message exists but is marked as deleted, allow re-upload
    if (existingMessage?.id) {
      const { data: deletedCheck } = await supabase
        .from('messages')
        .select('deleted_from_telegram')
        .eq('id', existingMessage.id)
        .single();

      if (deletedCheck?.deleted_from_telegram) {
        await logMessageOperation('reupload', correlationId, {
          message: 'Re-uploading previously deleted message',
          existing_message_id: existingMessage.id
        });
        
        // Update the existing record instead of creating new
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            deleted_from_telegram: false,
            caption,
            telegram_message_id: message_id,
            chat_id: chat.id,
            processing_state: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);

        if (updateError) {
          throw updateError;
        }
        return;
      }
    }

    // Prepare message data
    const messageInsert = {
      telegram_message_id: message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id,
      caption,
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      width: media.width,
      height: media.height,
      duration: 'duration' in media ? media.duration : null,
      mime_type: 'mime_type' in media ? media.mime_type : 'image/jpeg',
      processing_state: 'initialized',
      correlation_id: correlationId,
      message_url: `https://t.me/c/${chat.id.toString().slice(4)}/${message_id}`
    };

    // Insert new message
    const { error: insertError } = await supabase
      .from('messages')
      .insert([messageInsert]);

    if (insertError) {
      // If duplicate, log and continue
      if (insertError.code === '23505') {
        await logMessageOperation('duplicate', correlationId, {
          message: 'Duplicate message detected, skipping',
          telegram_message_id: message_id,
          file_unique_id: media.file_unique_id
        });
        return;
      }
      throw insertError;
    }

    await logMessageOperation('success', correlationId, {
      message: 'Message processed successfully',
      telegram_message_id: message_id
    });

  } catch (error) {
    await logMessageOperation('error', correlationId, {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegram_message_id: messageData.message_id
    });
    throw error;
  }
};


import { corsHeaders } from "../_shared/cors.ts";
import { SupabaseClient } from "@supabase/supabase-js";
import { logMessageOperation } from "./logger.ts";
import { downloadMedia, uploadMediaToStorage, extractMediaInfo } from "./mediaUtils.ts";

async function handleMediaMessage(
  supabase: SupabaseClient,
  messageData: any,
  botToken: string,
  correlationId: string
) {
  const mediaInfo = extractMediaInfo(messageData);
  
  if (!mediaInfo) {
    await logMessageOperation('skip', correlationId, {
      message: 'No media found in message',
      telegram_message_id: messageData.message_id
    });
    return null;
  }

  try {
    const mediaBuffer = await downloadMedia(mediaInfo.file_id, botToken, correlationId);
    const publicUrl = await uploadMediaToStorage(
      mediaBuffer,
      mediaInfo.storage_path,
      mediaInfo.mime_type,
      supabase,
      correlationId
    );

    return {
      ...mediaInfo,
      public_url: publicUrl
    };
  } catch (error) {
    await logMessageOperation('error', correlationId, {
      message: 'Error handling media message',
      error: error instanceof Error ? error.message : 'Unknown error',
      telegram_message_id: messageData.message_id
    });
    throw error;
  }
}

export const handleMessage = async (
  supabase: SupabaseClient,
  messageData: any,
  botToken: string,
  correlationId: string,
  messageType: string
) => {
  try {
    const { message_id, chat, media_group_id, caption } = messageData;
    const isEdit = messageType.includes('edited');

    // Check for existing message if this is an edit
    if (isEdit) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('telegram_message_id', message_id)
        .eq('chat_id', chat.id)
        .maybeSingle();

      if (existingMessage) {
        // Store current analyzed_content in history
        const updateData = {
          caption,
          is_edited: true,
          edit_date: new Date().toISOString(),
          processing_state: 'pending',
          old_analyzed_content: existingMessage.analyzed_content 
            ? [...(existingMessage.old_analyzed_content || []), existingMessage.analyzed_content]
            : existingMessage.old_analyzed_content,
          analyzed_content: null,
          edit_history: [
            ...(existingMessage.edit_history || []),
            {
              edit_date: new Date().toISOString(),
              previous_caption: existingMessage.caption,
              new_caption: caption,
              edit_type: messageType
            }
          ]
        };

        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', existingMessage.id);

        if (updateError) throw updateError;
        return;
      }
    }

    // Handle media upload for new messages or untracked edits
    const mediaResult = await handleMediaMessage(supabase, messageData, botToken, correlationId);
    
    if (!mediaResult) {
      // Store non-media messages in other_messages
      const { error } = await supabase
        .from('other_messages')
        .insert({
          telegram_message_id: message_id,
          chat_id: chat.id,
          chat_type: chat.type,
          message_type: messageType,
          telegram_data: messageData,
          correlation_id: correlationId
        });

      if (error) throw error;
      return;
    }

    // Prepare message data
    const messageInsert = {
      telegram_message_id: message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id,
      caption,
      file_id: mediaResult.file_id,
      file_unique_id: mediaResult.file_unique_id,
      width: mediaResult.width,
      height: mediaResult.height,
      duration: mediaResult.duration,
      mime_type: mediaResult.mime_type,
      public_url: mediaResult.public_url,
      processing_state: 'initialized',
      correlation_id: correlationId,
      message_url: `https://t.me/c/${chat.id.toString().slice(4)}/${message_id}`,
      is_edited_channel_post: messageType === 'edited_channel_post',
      edit_date: isEdit ? new Date().toISOString() : null,
      edit_history: isEdit ? [{ 
        edit_date: new Date().toISOString(),
        edit_type: messageType
      }] : []
    };

    // Insert new message
    const { error: insertError } = await supabase
      .from('messages')
      .insert([messageInsert]);

    if (insertError) {
      // If duplicate, try to update instead
      if (insertError.code === '23505') {
        const { error: updateError } = await supabase
          .from('messages')
          .update(messageInsert)
          .eq('telegram_message_id', message_id)
          .eq('chat_id', chat.id);

        if (updateError) throw updateError;
      } else {
        throw insertError;
      }
    }

    await logMessageOperation('success', correlationId, {
      message: 'Message processed successfully',
      telegram_message_id: message_id,
      message_type: messageType
    });

  } catch (error) {
    await logMessageOperation('error', correlationId, {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegram_message_id: messageData.message_id,
      message_type: messageType
    });
    throw error;
  }
};

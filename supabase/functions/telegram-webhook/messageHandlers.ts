
import { corsHeaders } from "../_shared/cors.ts";
import { SupabaseClient } from "@supabase/supabase-js";
import { logMessageOperation } from "./logger.ts";
import { downloadMedia, uploadMediaToStorage, extractMediaInfo } from "./mediaUtils.ts";

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

async function handleMediaMessage(
  supabase: SupabaseClient,
  messageData: MessageData,
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
  messageData: MessageData,
  botToken: string,
  correlationId: string
) => {
  try {
    const { message_id, chat, media_group_id, caption } = messageData;

    // Handle media upload first
    const mediaResult = await handleMediaMessage(supabase, messageData, botToken, correlationId);
    
    if (!mediaResult) {
      return; // Skip if no media
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
      message_url: `https://t.me/c/${chat.id.toString().slice(4)}/${message_id}`
    };

    // Insert new message
    const { error: insertError } = await supabase
      .from('messages')
      .insert([messageInsert]);

    if (insertError) {
      await logMessageOperation('error', correlationId, {
        message: 'Error inserting message',
        error: insertError.message,
        telegram_message_id: message_id
      });
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

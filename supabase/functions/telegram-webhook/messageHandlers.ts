
import { getLogger } from "./logger.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  caption?: string;
  media_group_id?: string;
  telegram_data?: any;
  is_edited?: boolean;
  is_channel?: boolean;
  update_id?: number;
}

interface MediaInfo {
  fileId: string;
  fileUniqueId: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  mediaType: 'photo' | 'video' | 'document';
}

export async function handleMessage(
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
): Promise<Response> {
  const logger = getLogger(correlationId);

  try {
    logger.info('Processing message', {
      messageId: message.message_id,
      chatId: message.chat.id,
      correlationId
    });

    if (!message.photo && !message.video && !message.document) {
      logger.info('No media content found in message', { correlationId });
      return new Response(
        JSON.stringify({ success: true, message: 'No media to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      logger.warn('Could not extract media info', { correlationId });
      return new Response(
        JSON.stringify({ success: false, message: 'Could not extract media info' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      processing_correlation_id: correlationId,
      processing_state: 'pending',
      telegram_data: message,
      file_id: mediaInfo.fileId,
      file_unique_id: mediaInfo.fileUniqueId,
      mime_type: mediaInfo.mimeType,
      file_size: mediaInfo.fileSize,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      media_type: mediaInfo.mediaType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    logger.info('Inserting message into database', { 
      fileUniqueId: mediaInfo.fileUniqueId,
      correlationId 
    });

    const { error: insertError } = await supabase
      .from('messages')
      .insert(messageData);

    if (insertError) {
      logger.error('Database insert failed', { 
        error: insertError,
        correlationId 
      });
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Message processed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Message handling failed', { 
      error: error.message,
      correlationId 
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to process message',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

function extractMediaInfo(message: TelegramMessage): MediaInfo | null {
  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo.reduce((prev, current) => 
      (prev.width * prev.height > current.width * current.height) ? prev : current
    );
    
    return {
      fileId: largestPhoto.file_id,
      fileUniqueId: largestPhoto.file_unique_id,
      mimeType: 'image/jpeg',
      width: largestPhoto.width,
      height: largestPhoto.height,
      fileSize: largestPhoto.file_size,
      mediaType: 'photo'
    };
  }
  
  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      mimeType: message.video.mime_type || 'video/mp4',
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      fileSize: message.video.file_size,
      mediaType: 'video'
    };
  }
  
  if (message.document) {
    const isVideo = message.document.mime_type?.startsWith('video/');
    const isImage = message.document.mime_type?.startsWith('image/');
    
    return {
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
      mediaType: isVideo ? 'video' : isImage ? 'photo' : 'document'
    };
  }
  
  return null;
}

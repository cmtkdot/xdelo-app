
import { getLogger } from "./logger.ts";
import { type TelegramMessage } from "./types.ts";
import { type SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

export const handleMessage = async (
  message: TelegramMessage, 
  supabase: SupabaseClient,
  correlationId: string
) => {
  const logger = getLogger(correlationId);
  
  try {
    if (message.photo || message.document) {
      const mediaInfo = extractMediaInfo(message);
      
      // Use file_unique_id as primary key
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
        ...mediaInfo && {
          file_id: mediaInfo.fileId,
          file_unique_id: mediaInfo.fileUniqueId,
          mime_type: mediaInfo.mimeType,
          file_size: mediaInfo.fileSize,
          width: mediaInfo.width,
          height: mediaInfo.height,
          duration: mediaInfo.duration,
          media_type: mediaInfo.mediaType
        }
      };

      // Insert using file_unique_id as constraint
      const { error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) {
        logger.error('Error inserting message', { error: insertError });
        throw insertError;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error handling message', { error });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Helper to extract media info
const extractMediaInfo = (message: TelegramMessage) => {
  if (message.photo) {
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
};

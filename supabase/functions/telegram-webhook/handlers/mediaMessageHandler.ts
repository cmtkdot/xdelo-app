
import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext, MessageInput } from '../types.ts';
import { xdelo_getExtensionFromMedia, xdelo_constructStoragePath, xdelo_uploadMediaToStorage } from '../../_shared/mediaUtils.ts';

export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    console.log(`Processing media message ${message.message_id} in chat ${message.chat.id}, correlation_id: ${correlationId}`);

    // Get media information from the message
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const document = message.document;
    
    const media = photo || video || document;
    if (!media) {
      throw new Error('No media found in message');
    }

    // Get file extension based on media type
    const extension = xdelo_getExtensionFromMedia(message);
    
    // Generate standardized storage path using just the extension
    const storagePath = xdelo_constructStoragePath(media.file_unique_id, extension);

    // Prepare message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      media_group_id: message.media_group_id,
      caption: message.caption,
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: video?.mime_type || document?.mime_type || 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      telegram_data: message,
      correlation_id: correlationId,
      processing_state: message.caption ? 'pending' : 'no_caption'
    };

    // If message is forwarded, add forward info
    if (message.forward_origin || message.forward_from_chat) {
      messageInput.forward_info = {
        is_forwarded: true,
        forward_origin_type: message.forward_origin?.type,
        forward_from_chat_id: message.forward_from_chat?.id || message.forward_origin?.chat?.id,
        forward_from_chat_title: message.forward_from_chat?.title || message.forward_origin?.chat?.title,
        forward_from_chat_type: message.forward_from_chat?.type || message.forward_origin?.chat?.type,
        forward_from_message_id: message.forward_from_message_id,
        forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : undefined
      };
    }

    // Always insert new message record
    const { data: newMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert(messageInput)
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`Created message record with ID: ${newMessage.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error handling media message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

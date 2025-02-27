
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getMediaInfo } from "./mediaUtils.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

export async function handleMediaMessage(message: any, context: any) {
  try {
    // Check for duplicates before proceeding
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, telegram_message_id')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log(`Message ${message.message_id} already exists, skipping processing`);
      return new Response(JSON.stringify({ 
        message: "Message already processed", 
        id: existingMessage.id,
        correlation_id: context.correlationId
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Extract media information
    let mediaInfo;
    try {
      mediaInfo = await getMediaInfo(message);
      console.log(`Media processed successfully for message ${message.message_id}`);
    } catch (error) {
      console.error(`Media processing error for message ${message.message_id}:`, error);
      mediaInfo = {
        file_id: message.photo ? message.photo[message.photo.length - 1].file_id : 
                 message.video ? message.video.file_id : 
                 message.document.file_id,
        file_unique_id: message.photo ? message.photo[message.photo.length - 1].file_unique_id : 
                        message.video ? message.video.file_unique_id : 
                        message.document.file_unique_id,
        mime_type: message.video ? message.video.mime_type : 
                   message.document ? message.document.mime_type : 
                   'image/jpeg',
        public_url: null,
        processing_error: error.message
      };
    }

    // Prepare database record
    const mediaRecord = {
      telegram_message_id: message.message_id,
      telegram_data: message,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title || message.chat.username || `${message.chat.first_name || ''} ${message.chat.last_name || ''}`.trim(),
      caption: message.caption,
      media_group_id: message.media_group_id,
      is_channel_post: context.isChannelPost,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      public_url: mediaInfo.public_url,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_forward: context.isForwarded,
      forward_from: message.forward_from,
      forward_from_chat: message.forward_from_chat,
      correlation_id: context.correlationId,
      message_url: constructMessageUrl(message.chat, message.message_id)
    };

    // Insert record into database
    const { data: insertedRecord, error: insertError } = await supabase
      .from('messages')
      .insert(mediaRecord)
      .select('id')
      .single();

    if (insertError) {
      console.error(`Database insert error: ${insertError.message}`);
      throw insertError;
    }

    // Log the successful operation
    await supabase.from('webhook_logs').insert({
      event_type: 'media_message_processed',
      chat_id: message.chat.id,
      message_id: insertedRecord.id,
      media_type: mediaInfo.mime_type,
      raw_data: { message, mediaInfo }
    });

    // Return success response
    return new Response(
      JSON.stringify({
        message: "Media message processed successfully",
        id: insertedRecord.id,
        correlation_id: context.correlationId
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    // Log error to database
    try {
      await supabase.from('webhook_logs').insert({
        event_type: 'media_message_error',
        chat_id: message.chat?.id,
        error_message: error.message,
        raw_data: message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Re-throw to be handled by caller
    throw error;
  }
}

export async function handleOtherMessage(message: any, context: any) {
  try {
    // Check if message already exists
    const { data: existingMessage } = await supabase
      .from('other_messages')
      .select('id')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log(`Other message ${message.message_id} already exists, skipping`);
      return new Response(JSON.stringify({ 
        message: "Message already processed", 
        id: existingMessage.id
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Prepare database record
    const messageRecord = {
      telegram_message_id: message.message_id,
      telegram_data: message,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title || message.chat.username || `${message.chat.first_name || ''} ${message.chat.last_name || ''}`.trim(),
      text: message.text || message.caption,
      message_type: getMessage​Type(message),
      is_channel_post: context.isChannelPost,
      is_forward: context.isForwarded,
      forward_from: message.forward_from,
      forward_from_chat: message.forward_from_chat,
      correlation_id: context.correlationId,
      message_url: constructMessageUrl(message.chat, message.message_id)
    };

    // Insert into database
    const { data: insertedRecord, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageRecord)
      .select('id')
      .single();

    if (insertError) {
      console.error(`Database insert error: ${insertError.message}`);
      throw insertError;
    }

    // Log successful operation
    await supabase.from('webhook_logs').insert({
      event_type: 'other_message_processed',
      chat_id: message.chat.id,
      message_id: insertedRecord.id,
      raw_data: message
    });

    // Return success response
    return new Response(
      JSON.stringify({
        message: "Other message processed successfully",
        id: insertedRecord.id,
        correlation_id: context.correlationId
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    // Log error to database
    try {
      await supabase.from('webhook_logs').insert({
        event_type: 'other_message_error',
        chat_id: message.chat?.id,
        error_message: error.message,
        raw_data: message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Re-throw to be handled by caller
    throw error;
  }
}

// Helper function to determine message type
function getMessage​Type(message: any): string {
  if (message.text) return 'text';
  if (message.sticker) return 'sticker';
  if (message.animation) return 'animation';
  if (message.audio) return 'audio';
  if (message.voice) return 'voice';
  if (message.video_note) return 'video_note';
  if (message.contact) return 'contact';
  if (message.location) return 'location';
  if (message.venue) return 'venue';
  if (message.poll) return 'poll';
  if (message.dice) return 'dice';
  if (message.game) return 'game';
  if (message.invoice) return 'invoice';
  return 'unknown';
}

// Helper function to construct message URL
function constructMessageUrl(chat: any, messageId: number): string {
  if (!chat || !messageId) return '';
  
  let chatId = chat.id.toString();
  // Handle channels/groups with -100 prefix
  if (chatId.startsWith('-100')) {
    chatId = chatId.substring(4);
  } else if (chatId.startsWith('-')) {
    chatId = chatId.substring(1);
  }
  
  return `https://t.me/c/${chatId}/${messageId}`;
}

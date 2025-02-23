
import { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessingState } from '../_shared/states.ts';
import { corsHeaders } from '../_shared/cors.ts';

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
    file_size: number;
    width: number;
    height: number;
  }>;
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  };
  caption?: string;
  media_group_id?: string;
  date: number;
  edit_date?: number;
  telegram_data?: Record<string, any>;
}

export const handleMessage = async (
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) => {
  try {
    console.log('Processing message:', { messageId: message.message_id, correlationId });

    // Extract media info if present
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      console.log('No media found in message');
      return new Response(
        JSON.stringify({ success: false, error: 'No media found in message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare message data
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      processing_state: 'pending' as ProcessingState,
      processing_correlation_id: correlationId,
      telegram_data: message.telegram_data || {},
      ...mediaInfo
    };

    // Log the webhook event
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'new_message',
      p_chat_id: message.chat.id,
      p_message_id: message.message_id,
      p_media_type: mediaInfo.mime_type,
      p_raw_data: message
    });

    // Insert message into database
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, message: newMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error handling message:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

export const handleEditedMessage = async (
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) => {
  try {
    console.log('Processing edited message:', { messageId: message.message_id, correlationId });

    // Update the existing message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption: message.caption,
        updated_at: new Date().toISOString(),
        processing_state: 'pending' as ProcessingState,
        processing_correlation_id: correlationId,
        telegram_data: {
          ...message.telegram_data,
          edit_date: message.edit_date
        }
      })
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // Log the webhook event
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'edit_message',
      p_chat_id: message.chat.id,
      p_message_id: message.message_id,
      p_raw_data: message
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error handling edited message:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

const extractMediaInfo = (message: TelegramMessage) => {
  if (message.photo) {
    // Get the largest photo version
    const largestPhoto = message.photo.reduce((prev, current) => 
      (prev.width * prev.height > current.width * current.height) ? prev : current
    );
    
    return {
      file_id: largestPhoto.file_id,
      file_unique_id: largestPhoto.file_unique_id,
      mime_type: 'image/jpeg',
      width: largestPhoto.width,
      height: largestPhoto.height,
      file_size: largestPhoto.file_size
    };
  }
  
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type,
      file_size: message.document.file_size
    };
  }
  
  return null;
};

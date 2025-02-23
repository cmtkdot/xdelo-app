
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import type { ProcessingState, AnalyzedContent } from '../_shared/types.ts'

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
}

export const handleMessage = async (message: TelegramMessage, correlationId: string) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract media info from message
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      return new Response(JSON.stringify({ success: false, error: 'No media found in message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
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
      ...mediaInfo
    };

    // Insert message into database
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, message: newMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling message:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
};

const extractMediaInfo = (message: TelegramMessage) => {
  if (message.photo) {
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

// Handle edited messages
export const handleEditedMessage = async (message: TelegramMessage, correlationId: string) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find and update the existing message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption: message.caption,
        updated_at: new Date().toISOString(),
        processing_state: 'pending' as ProcessingState,
        processing_correlation_id: correlationId
      })
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling edited message:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
};

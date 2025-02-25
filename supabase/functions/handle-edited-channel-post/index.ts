
import { serve } from "http/server";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  console.log('Starting edit handler', { correlation_id: correlationId });

  try {
    const {
      message_id,
      chat_id,
      chat_type,
      caption,
      media_group_id,
      is_channel_post
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Processing edit request', {
      message_id,
      chat_id,
      media_group_id,
      correlation_id: correlationId
    });

    // Find and update the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .update({
        caption,
        is_edited: true,
        edit_date: new Date().toISOString(),
        chat_type,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .select()
      .single();

    if (messageError) {
      console.error('Error updating message', {
        error: messageError,
        correlation_id: correlationId
      });
      throw messageError;
    }

    console.log('Message updated successfully', {
      message_id: message.id,
      correlation_id: correlationId
    });

    // Trigger reanalysis - the database trigger will handle group syncing
    const { error: analysisError } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: message.id,
        caption,
        correlation_id,
        is_edit: true,
        media_group_id,
        is_channel_post
      }
    });

    if (analysisError) {
      console.error('Error triggering reanalysis', {
        error: analysisError,
        correlation_id: correlationId
      });
      throw analysisError;
    }

    console.log('Edit processing completed', {
      message_id: message.id,
      correlation_id: correlationId
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    console.error('Edit handler error', {
      error: error.message,
      stack: error.stack,
      correlation_id: correlationId
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

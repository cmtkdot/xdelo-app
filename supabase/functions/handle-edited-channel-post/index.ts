
import { serve } from "http/server";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

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

    if (messageError) throw messageError;

    // The database trigger will handle:
    // 1. Resetting analyzed_content
    // 2. Updating processing state
    // 3. Updating media group messages
    // 4. Maintaining edit history

    // Trigger reanalysis
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: message.id,
        caption,
        correlation_id,
        is_edit: true,
        media_group_id,
        is_channel_post
      }
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

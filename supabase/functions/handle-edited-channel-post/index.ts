
import { serve } from "http/server";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const { message_id, chat_id, caption, media_group_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First, update the edited message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .update({
        caption,
        analyzed_content: null,
        processing_state: 'pending',
        group_caption_synced: false,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .select()
      .single();

    if (messageError) throw messageError;

    // If part of a media group, update all related messages
    if (media_group_id) {
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: null,
          processing_state: 'pending',
          group_caption_synced: false,
          updated_at: new Date().toISOString()
        })
        .eq('media_group_id', media_group_id)
        .neq('telegram_message_id', message_id);

      if (groupUpdateError) throw groupUpdateError;
    }

    // Trigger reanalysis
    const { error: analysisError } = await supabase.functions.invoke(
      'parse-caption-with-ai',
      {
        body: {
          message_id: message.id,
          caption,
          correlation_id: correlationId,
          is_edit: true,
          media_group_id
        }
      }
    );

    if (analysisError) throw analysisError;

    return new Response(
      JSON.stringify({ success: true, correlation_id: correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlation_id: correlationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

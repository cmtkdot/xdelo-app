import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message_id, media_group_id, caption } = await req.json();
    console.log(`Processing caption sync for message ${message_id} in group ${media_group_id}`);

    // Update the source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption,
        is_original_caption: true,
        processing_state: 'caption_ready'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // Update all other messages in the group
    const { error: groupUpdateError } = await supabase
      .from('messages')
      .update({
        caption,
        is_original_caption: false,
        message_caption_id: message_id,
        processing_state: 'caption_ready'
      })
      .eq('media_group_id', media_group_id)
      .neq('id', message_id);

    if (groupUpdateError) throw groupUpdateError;

    // Trigger the parse-caption-with-ai function
    const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { message_id, media_group_id, caption }
    });

    if (parseError) {
      console.error('Error triggering caption parsing:', parseError);
      throw parseError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Caption synced and analysis triggered',
        parse_result: parseData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error syncing caption:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to sync caption or trigger analysis'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
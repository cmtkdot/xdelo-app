import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  message_id: string;
  media_group_id: string;
  caption: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message_id, media_group_id, caption } = await req.json() as SyncRequest;
    console.log(`Processing caption sync for message ${message_id} in group ${media_group_id}`);

    // Get the current message to check its analysis state
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('analyzed_content, fresh_analysis')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;

    // Use fresh_analysis if available, fallback to analyzed_content
    const analysisContent = message?.fresh_analysis || message?.analyzed_content;

    // Update all messages in the group with the caption and analysis
    const { error: updateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analysisContent,
        p_processing_completed_at: new Date().toISOString()
      }
    );

    if (updateError) throw updateError;

    // Trigger the parse-caption-all function to analyze the caption
    const parseResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id,
          caption,
          media_group_id
        })
      }
    );

    if (!parseResponse.ok) {
      console.error('Error triggering caption parsing:', await parseResponse.text());
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error syncing caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
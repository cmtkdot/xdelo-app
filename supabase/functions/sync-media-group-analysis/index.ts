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
    const { message_id, media_group_id, analyzed_content } = await req.json();
    console.log('Syncing media group analysis:', { message_id, media_group_id });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const processingCompletedAt = new Date().toISOString();

    const { error } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzed_content,
        p_processing_completed_at: processingCompletedAt
      }
    );

    if (error) {
      console.error('Error in process_media_group_analysis:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Media group analysis synced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-media-group-analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
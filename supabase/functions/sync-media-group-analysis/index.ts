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

    const { message_id, media_group_id, analyzed_content, processing_completed_at } = await req.json();
    console.log(`Processing media group analysis for message ${message_id} in group ${media_group_id}`);

    // Call the database function to process the media group
    const { data, error } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: analyzed_content,
      p_processing_completed_at: processing_completed_at
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed_content: analyzed_content,
        message: 'Media group analysis synced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media group:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to sync media group analysis'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
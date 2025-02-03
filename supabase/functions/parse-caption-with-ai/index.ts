import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./aiParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Processing caption:', { message_id, media_group_id, has_caption: !!caption });

    if (!caption) {
      throw new Error('No caption provided for analysis');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Analyze the caption
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis result:', analyzedContent);

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'analysis_synced',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString()
      });

      if (syncError) {
        throw syncError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to analyze caption'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
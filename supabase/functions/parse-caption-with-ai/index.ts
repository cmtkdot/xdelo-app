import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Add detailed logging
  console.log('Starting parse-caption-with-ai function');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Processing request:', { message_id, media_group_id, has_caption: !!caption });

    if (!message_id) {
      throw new Error('message_id is required');
    }

    if (!caption) {
      throw new Error('No caption provided for analysis');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update state to analyzing
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'analyzing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message state:', updateError);
      throw updateError;
    }

    // Analyze the caption
    console.log('Starting caption analysis');
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis completed:', analyzedContent);

    // Update the message with analyzed content
    const { error: contentUpdateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'analysis_synced',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (contentUpdateError) {
      console.error('Error updating analyzed content:', contentUpdateError);
      throw contentUpdateError;
    }

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      console.log('Syncing media group analysis');
      const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString()
      });

      if (syncError) {
        console.error('Error syncing media group:', syncError);
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
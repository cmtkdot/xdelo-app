import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

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
    console.log('Processing caption analysis for message:', { message_id, media_group_id, caption });

    if (!message_id || !caption) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First update the message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        is_original_caption: true
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // Analyze the caption
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis completed:', analyzedContent);

    // Add a delay for AI analysis to ensure proper syncing
    if (analyzedContent.parsing_metadata?.method === 'ai') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Update the source message with analyzed content
    const { error: sourceUpdateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: true
      })
      .eq('id', message_id);

    if (sourceUpdateError) throw sourceUpdateError;

    // If this is part of a media group, process the entire group
    if (media_group_id) {
      // Add additional delay before group sync for AI analysis
      if (analyzedContent.parsing_metadata?.method === 'ai') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { error: groupError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString()
      });

      if (groupError) throw groupError;

      // Log the group synchronization
      await supabase
        .from('analysis_audit_log')
        .insert({
          message_id,
          media_group_id,
          event_type: 'GROUP_ANALYSIS_COMPLETED',
          new_state: 'completed',
          analyzed_content: analyzedContent,
          processing_details: {
            method: analyzedContent.parsing_metadata?.method || 'unknown',
            sync_type: 'group',
            sync_delay: analyzedContent.parsing_metadata?.method === 'ai' ? 3000 : 0
          }
        });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Caption analyzed successfully', 
        analyzed_content: analyzedContent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      // Create a new request body for error update
      const { message_id } = await req.clone().json();
      
      if (message_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('messages')
          .update({ 
            processing_state: 'error',
            error_message: error.message,
            last_error_at: new Date().toISOString()
          })
          .eq('id', message_id);
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
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

    // First, check if this is part of a media group and if there's already an analyzed message
    if (media_group_id) {
      const { data: existingAnalysis } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', media_group_id)
        .eq('is_original_caption', true)
        .eq('processing_state', 'completed')
        .maybeSingle();

      if (existingAnalysis) {
        console.log('Found existing analysis for media group:', existingAnalysis.id);
        // Update current message to use existing analysis
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: existingAnalysis.analyzed_content,
            processing_state: 'completed',
            message_caption_id: existingAnalysis.id,
            is_original_caption: false,
            group_caption_synced: true
          })
          .eq('id', message_id);

        if (updateError) throw updateError;
        
        return new Response(
          JSON.stringify({ 
            message: 'Message synced with existing group analysis',
            analyzed_content: existingAnalysis.analyzed_content 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update message state to processing
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    // Analyze caption
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis completed:', analyzedContent);

    // If this is part of a media group, process the entire group
    if (media_group_id) {
      // First update the source message
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

      // Then update other messages in the group
      const { error: groupError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          message_caption_id: message_id,
          is_original_caption: false,
          group_caption_synced: true
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

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
            method: 'ai',
            sync_type: 'group'
          }
        });
    } else {
      // Update single message
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: true
        })
        .eq('id', message_id);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({ message: 'Caption analyzed successfully', analyzed_content: analyzedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    // Update message state to error
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      await supabase
        .from('messages')
        .update({ 
          processing_state: 'error',
          error_message: error.message,
          last_error_at: new Date().toISOString()
        })
        .eq('id', (await req.json()).message_id);
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
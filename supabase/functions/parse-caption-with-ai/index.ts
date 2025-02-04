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
    const { message_id, media_group_id, caption, correlation_id, is_reanalysis } = await req.json();
    
    console.log('Starting caption analysis:', { message_id, media_group_id, correlation_id, is_reanalysis });

    if (!caption || typeof caption !== 'string') {
      throw new Error('Caption is required and must be a string');
    }

    // Allow empty captions but log them
    if (caption.trim() === '') {
      console.log('Empty caption received, proceeding with basic analysis');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Analyze the caption using AI
    const analyzedContent = await analyzeCaption(caption);
    console.log('Caption analyzed successfully:', analyzedContent);

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // If this is part of a media group, update all related messages
    if (media_group_id) {
      console.log('Updating media group messages:', media_group_id);
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          group_caption_synced: true,
          message_caption_id: message_id
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
        throw groupUpdateError;
      }
    }

    // Log the analysis completion
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: is_reanalysis ? 'REANALYSIS_COMPLETED' : 'ANALYSIS_COMPLETED',
      old_state: 'pending',
      new_state: 'completed',
      analyzed_content: analyzedContent,
      processing_details: {
        correlation_id,
        timestamp: new Date().toISOString(),
        is_reanalysis: !!is_reanalysis,
        is_media_group: !!media_group_id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Caption parsed and processed successfully',
        analyzed_content: analyzedContent,
        correlation_id
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
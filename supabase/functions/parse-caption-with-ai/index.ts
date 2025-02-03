import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { manualParse } from "./utils/manualParser.ts";

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
    console.log('Starting caption analysis for message:', { message_id, media_group_id, caption });

    if (!message_id || !caption) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First update message state to processing
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Failed to update message state:', updateError);
      throw updateError;
    }

    // Try manual parsing first
    console.log('Attempting manual parsing...');
    const manualResult = await manualParse(caption);
    
    let analyzedContent;
    let parsingMethod = 'manual';
    
    if (manualResult && manualResult.product_name && manualResult.quantity) {
      console.log('Manual parsing successful:', manualResult);
      analyzedContent = manualResult;
    } else {
      console.log('Manual parsing incomplete, attempting AI analysis...');
      parsingMethod = 'ai';
      
      // Update state to indicate AI analysis is starting
      await supabase
        .from('messages')
        .update({ 
          processing_state: 'processing',
          analyzed_content: {
            parsing_metadata: {
              method: 'ai',
              status: 'processing'
            }
          }
        })
        .eq('id', message_id);

      analyzedContent = await analyzeCaption(caption);
    }

    console.log('Analysis completed:', { 
      method: parsingMethod, 
      message_id,
      media_group_id,
      content: analyzedContent 
    });

    // Update the source message with analysis results
    const { error: sourceUpdateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: {
          ...analyzedContent,
          parsing_metadata: {
            ...analyzedContent.parsing_metadata,
            method: parsingMethod,
            completed_at: new Date().toISOString()
          }
        },
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true
      })
      .eq('id', message_id);

    if (sourceUpdateError) {
      console.error('Failed to update source message:', sourceUpdateError);
      throw sourceUpdateError;
    }

    // Only sync media group if this is part of one and analysis was successful
    if (media_group_id && analyzedContent) {
      console.log('Syncing media group analysis...');
      try {
        const { error: groupError } = await supabase.rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString()
        });

        if (groupError) throw groupError;
        console.log('Media group sync completed successfully');
      } catch (error) {
        console.error('Error syncing media group:', error);
        // Update source message to error state but keep analyzed content
        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: `Media group sync failed: ${error.message}`
          })
          .eq('id', message_id);
        throw error;
      }
    }

    // Log the analysis completion
    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id,
        event_type: 'ANALYSIS_COMPLETED',
        new_state: 'completed',
        analyzed_content: analyzedContent,
        processing_details: {
          method: parsingMethod,
          duration_ms: Date.now() - new Date(analyzedContent.parsing_metadata?.started_at || Date.now()).getTime()
        }
      });

    return new Response(
      JSON.stringify({ 
        message: 'Caption analyzed successfully', 
        analyzed_content: analyzedContent,
        parsing_method: parsingMethod
      }),
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

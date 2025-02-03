import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { aiParse } from "./aiParser.ts";
import { manualParse } from "./manualParser.ts";
import { ParsedContent, AnalysisResult } from "./types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error('Error parsing request body:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { message_id, media_group_id, caption } = requestBody;

  if (!message_id || !caption) {
    console.error('Missing required parameters:', { message_id, caption });
    return new Response(
      JSON.stringify({ error: 'message_id and caption are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update message to processing state immediately
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // Log initial state
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'ANALYSIS_STARTED',
      old_state: 'initialized',
      new_state: 'processing',
      processing_details: {
        timestamp: new Date().toISOString(),
        caption: caption
      }
    });

    // Try manual parsing first
    console.log('Attempting manual parsing for caption:', caption);
    let analyzedContent: ParsedContent = await manualParse(caption);
    let isAiAnalysis = false;

    // If manual parsing doesn't yield good results, try AI parsing
    if (!analyzedContent.product_name || !analyzedContent.product_code || !analyzedContent.quantity) {
      console.log('Manual parsing incomplete, attempting AI analysis');
      analyzedContent = await aiParse(caption);
      isAiAnalysis = true;

      // Add delay for AI analysis to ensure proper syncing
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Ensure analyzed_content is properly formatted as JSONB
    const formattedAnalyzedContent = {
      ...analyzedContent,
      parsing_metadata: {
        method: isAiAnalysis ? 'ai' : 'manual',
        confidence: isAiAnalysis ? 0.8 : 0.9,
        timestamp: new Date().toISOString()
      }
    };

    // Log the analysis method
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'ANALYSIS_METHOD_SELECTED',
      new_state: 'processing',
      analyzed_content: formattedAnalyzedContent,
      processing_details: {
        method: isAiAnalysis ? 'ai' : 'manual',
        confidence: formattedAnalyzedContent.parsing_metadata.confidence,
        timestamp: new Date().toISOString()
      }
    });

    // Use RPC call to process media group analysis
    const { error: contentUpdateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: formattedAnalyzedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: crypto.randomUUID()
      }
    );

    if (contentUpdateError) {
      console.error('Error updating content:', contentUpdateError);
      throw contentUpdateError;
    }

    const response: AnalysisResult = {
      message: 'Caption analyzed successfully',
      analyzed_content: formattedAnalyzedContent,
      processing_details: {
        method: isAiAnalysis ? 'ai' : 'manual',
        timestamp: new Date().toISOString(),
        group_id: media_group_id || undefined
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Log error in audit log
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'ERROR',
        new_state: 'error',
        processing_details: {
          error_message: error.message,
          timestamp: new Date().toISOString()
        }
      });

      // Update message error state
      await supabase
        .from('messages')
        .update({ 
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', message_id);
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
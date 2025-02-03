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

    // Log initial state
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'ANALYSIS_STARTED',
      old_state: 'initialized',
      new_state: 'processing',
      processing_details: {
        timestamp: new Date().toISOString(),
        caption
      }
    });

    // If this is part of a media group, wait for all messages to be in the database
    if (media_group_id) {
      console.log('Checking media group completeness:', media_group_id);
      
      let groupMessages = [];
      // Wait for up to 5 seconds for all messages to arrive
      for (let i = 0; i < 5; i++) {
        const { data: messages, error: groupError } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', media_group_id);

        if (groupError) throw groupError;

        if (messages && messages.length > 0) {
          groupMessages = messages;
          console.log(`Found ${messages.length} messages in group`);
          break;
        }

        if (i < 4) {
          console.log('Waiting for more messages...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // If no messages found after waiting, log warning
      if (groupMessages.length === 0) {
        console.warn('No messages found in group after waiting');
      }
    }

    // Update message to processing state
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    // Try manual parsing first
    console.log('Attempting manual parsing for caption:', caption);
    let analyzedContent: ParsedContent = await manualParse(caption);
    let isAiAnalysis = false;

    // If manual parsing doesn't yield good results, try AI parsing
    if (!analyzedContent.product_name || !analyzedContent.quantity) {
      console.log('Manual parsing incomplete, attempting AI analysis');
      analyzedContent = await aiParse(caption);
      isAiAnalysis = true;
    }

    // Log the analysis method
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'ANALYSIS_METHOD_SELECTED',
      new_state: 'processing',
      processing_details: {
        method: isAiAnalysis ? 'ai' : 'manual',
        confidence: analyzedContent.parsing_metadata?.confidence,
        timestamp: new Date().toISOString()
      }
    });

    // Add delay for AI analysis
    if (isAiAnalysis) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // First update the current message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: true
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // Only process media group if we have valid analyzed content and a media group ID
    if (analyzedContent && media_group_id) {
      console.log('Processing media group:', media_group_id);
      
      const { error: rpcError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: crypto.randomUUID()
      });

      if (rpcError) {
        console.error('Error in process_media_group_analysis:', rpcError);
        throw rpcError;
      }
    }

    const response: AnalysisResult = {
      message: 'Caption analyzed successfully',
      analyzed_content: analyzedContent,
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
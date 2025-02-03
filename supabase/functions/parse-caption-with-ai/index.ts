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

  try {
    const reqClone = req.clone();
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Starting caption analysis for:', { message_id, media_group_id, caption });

    if (!message_id || !caption) {
      throw new Error('Missing required parameters');
    }

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

    // Update message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: false
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // Try manual parsing first
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

    // Update the source message with analyzed content
    const { error: sourceUpdateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: media_group_id ? false : true
      })
      .eq('id', message_id);

    if (sourceUpdateError) throw sourceUpdateError;

    // Log successful analysis
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'ANALYSIS_COMPLETED',
      old_state: 'processing',
      new_state: 'completed',
      analyzed_content: analyzedContent
    });

    // Process media group if applicable
    if (media_group_id) {
      console.log('Processing media group:', media_group_id);
      
      // Add additional delay for AI analysis before group sync
      if (isAiAnalysis) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Log group sync start
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'GROUP_SYNC_STARTED',
        new_state: 'processing',
        processing_details: {
          timestamp: new Date().toISOString(),
          method: isAiAnalysis ? 'ai' : 'manual'
        }
      });

      // Update all other messages in the group
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: message_id
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupUpdateError) throw groupUpdateError;

      // Update the original message to mark group sync as complete
      const { error: originalUpdateError } = await supabase
        .from('messages')
        .update({
          group_caption_synced: true
        })
        .eq('id', message_id);

      if (originalUpdateError) throw originalUpdateError;

      // Log group sync completion
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'GROUP_SYNC_COMPLETED',
        new_state: 'completed',
        analyzed_content: analyzedContent,
        processing_details: {
          method: isAiAnalysis ? 'ai' : 'manual',
          sync_type: 'group',
          sync_delay: isAiAnalysis ? 3000 : 0,
          timestamp: new Date().toISOString()
        }
      });
    }

    const response: AnalysisResult = {
      message: 'Caption analyzed and synced successfully',
      analyzed_content: analyzedContent,
      processing_details: {
        method: isAiAnalysis ? 'ai' : 'manual',
        timestamp: new Date().toISOString(),
        group_id: media_group_id || undefined
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const { message_id } = await reqClone.json();
      
      if (message_id) {
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
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
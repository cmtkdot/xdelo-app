import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from "./manualParser.ts";
import { aiParse } from "./aiParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let messageId: string;
  let mediaGroupId: string | null;
  let caption: string;
  const correlationId = crypto.randomUUID();

  try {
    const requestData = await req.json();
    messageId = requestData.message_id;
    mediaGroupId = requestData.media_group_id;
    caption = requestData.caption;

    if (!messageId || !caption) {
      throw new Error('message_id and caption are required');
    }

    console.log('Processing caption:', { messageId, mediaGroupId, caption, correlationId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // First try manual parsing
    let parsedContent = await manualParse(caption);
    let confidence = parsedContent.parsing_metadata?.confidence || 0;

    // Log initial parsing attempt
    await supabase.from("analysis_audit_log").insert({
      message_id: messageId,
      media_group_id: mediaGroupId,
      event_type: "MANUAL_PARSE_COMPLETED",
      old_state: "processing",
      analyzed_content: parsedContent,
      processing_details: {
        correlation_id: correlationId,
        confidence,
        method: "manual"
      }
    });

    // If manual parsing has low confidence, try AI parsing
    if (confidence < 0.7) {
      console.log('Manual parsing had low confidence, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        if (aiResult.parsing_metadata?.confidence && aiResult.parsing_metadata.confidence > confidence) {
          parsedContent = aiResult;
          confidence = aiResult.parsing_metadata.confidence;

          // Log AI parsing success
          await supabase.from("analysis_audit_log").insert({
            message_id: messageId,
            media_group_id: mediaGroupId,
            event_type: "AI_PARSE_COMPLETED",
            old_state: "processing",
            analyzed_content: parsedContent,
            processing_details: {
              correlation_id: correlationId,
              confidence,
              method: "ai"
            }
          });
        }
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        // Log AI parsing failure but continue with manual results
        await supabase.from("analysis_audit_log").insert({
          message_id: messageId,
          media_group_id: mediaGroupId,
          event_type: "AI_PARSE_FAILED",
          error_message: aiError.message,
          processing_details: {
            correlation_id: correlationId,
            error: aiError.message
          }
        });
      }
    }

    // Update the message with the analyzed content
    const { error: contentUpdateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_analyzed_content: parsedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: correlationId
      }
    );

    if (contentUpdateError) {
      throw contentUpdateError;
    }

    return new Response(
      JSON.stringify({
        message: 'Caption analyzed successfully',
        analyzed_content: parsedContent,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey && messageId) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Update message error state
        await supabase
          .from('messages')
          .update({ 
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);

        // Log error in audit log
        await supabase.from("analysis_audit_log").insert({
          message_id: messageId,
          media_group_id: mediaGroupId,
          event_type: "PARSING_ERROR",
          old_state: "processing",
          new_state: "error",
          error_message: error.message,
          processing_details: {
            correlation_id: correlationId,
            error: error.message
          }
        });
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
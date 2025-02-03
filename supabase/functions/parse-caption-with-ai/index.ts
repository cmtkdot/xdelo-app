import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from "./manualParser.ts";
import { aiParse } from "./aiParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  let messageId: string;
  let mediaGroupId: string | null;
  let caption: string;
  let retryCount = 0;

  try {
    const requestData = await req.json();
    messageId = requestData.message_id;
    mediaGroupId = requestData.media_group_id;
    caption = requestData.caption;

    // Validate required fields
    if (!messageId || !caption) {
      throw new Error('message_id and caption are required fields');
    }

    console.log('Processing caption:', { messageId, mediaGroupId, caption, correlationId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First verify the message exists and get its current state
    const { data: existingMessage, error: messageError } = await supabase
      .from('messages')
      .select('id, processing_state, analyzed_content, is_original_caption, retry_count')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError || !existingMessage) {
      throw new Error(`Message not found or error: ${messageError?.message || 'Not found'}`);
    }

    // Check retry count
    if (existingMessage.retry_count && existingMessage.retry_count >= MAX_RETRIES) {
      throw new Error(`Maximum retry attempts (${MAX_RETRIES}) reached for message ${messageId}`);
    }

    // Update message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        retry_count: (existingMessage.retry_count || 0) + 1
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // First try manual parsing
    let parsedContent = await manualParse(caption);
    let confidence = parsedContent.parsing_metadata?.confidence || 0;

    // Log manual parsing attempt
    await supabase.from("analysis_audit_log").insert({
      message_id: messageId,
      media_group_id: mediaGroupId,
      event_type: "MANUAL_PARSE_COMPLETED",
      old_state: existingMessage.processing_state,
      analyzed_content: parsedContent,
      processing_details: {
        correlation_id: correlationId,
        confidence,
        method: "manual",
        original_caption: caption,
        message_id: messageId,
        retry_count: existingMessage.retry_count || 0
      }
    });

    // If manual parsing has low confidence (< 0.5), try AI parsing
    if (confidence < 0.5) {
      console.log('Manual parsing had low confidence, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        
        // Only use AI result if it has higher confidence
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
              method: "ai",
              original_caption: caption,
              message_id: messageId,
              retry_count: existingMessage.retry_count || 0
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
            error: aiError.message,
            original_caption: caption,
            message_id: messageId,
            retry_count: existingMessage.retry_count || 0
          }
        });
      }
    }

    // Update the message and sync with media group
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
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
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
            error: error.message,
            original_caption: caption,
            message_id: messageId,
            retry_count: retryCount
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
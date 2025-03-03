
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, mediaGroupId, correlationId = crypto.randomUUID() } = await req.json();
    console.log(`Processing message analysis for messageId: ${messageId}, correlationId: ${correlationId}`);

    // Call the database function instead of accessing the message directly
    const { data: dbResult, error: dbError } = await supabase.rpc('xdelo_analyze_message_caption', {
      p_message_id: messageId,
      p_correlation_id: correlationId,
      p_caption: caption,
      p_media_group_id: mediaGroupId
    });

    if (dbError) {
      throw new Error(`Database function error: ${dbError.message}`);
    }

    // Log successful preparation
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'edge_function_executed',
        entity_id: messageId,
        metadata: {
          correlation_id: correlationId,
          function_name: 'create-analyze-message-caption',
          success: true,
          result: dbResult
        },
        event_timestamp: new Date().toISOString()
      });

    // Call the parse-caption-with-ai function
    const parseCaptionResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          messageId: messageId,
          caption: caption,
          media_group_id: mediaGroupId,
          correlationId: correlationId,
          file_info: dbResult.file_info
        })
      }
    );

    if (!parseCaptionResponse.ok) {
      let errorMessage = 'Parse caption function returned an error';
      try {
        const errorData = await parseCaptionResponse.json();
        errorMessage = `Parse caption error: ${JSON.stringify(errorData)}`;
      } catch (e) {
        // If we can't parse the response, use the status text
        errorMessage = `Parse caption error: ${parseCaptionResponse.status} ${parseCaptionResponse.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const result = await parseCaptionResponse.json();

    // Log successful completion
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'analyze_message_completed',
        entity_id: messageId,
        metadata: {
          correlation_id: correlationId,
          success: true,
          result
        },
        event_timestamp: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message:', error);

    // Try to log the error
    try {
      const { messageId, correlationId } = await req.json();
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'analyze_message_failed',
          entity_id: messageId || 'unknown',
          error_message: error.message,
          metadata: {
            correlation_id: correlationId || crypto.randomUUID(),
            error_details: JSON.stringify(error)
          },
          event_timestamp: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

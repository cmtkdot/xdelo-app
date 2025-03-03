
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { messageId, caption, mediaGroupId, correlationId } = await req.json();
    console.log(`Processing message analysis for messageId: ${messageId}, correlationId: ${correlationId}`);

    // First check if the message exists
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Message fetch error: ${messageError.message}`);
    }

    // Update message processing state to 'processing'
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Message update error: ${updateError.message}`);
    }

    // Log the operation
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'analyze_message_started',
        entity_id: messageId,
        metadata: {
          correlation_id: correlationId,
          caption,
          media_group_id: mediaGroupId
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
          correlationId: correlationId
        })
      }
    );

    if (!parseCaptionResponse.ok) {
      const errorData = await parseCaptionResponse.json();
      throw new Error(`Parse caption error: ${JSON.stringify(errorData)}`);
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
      const { message, correlationId, messageId } = await req.json();
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

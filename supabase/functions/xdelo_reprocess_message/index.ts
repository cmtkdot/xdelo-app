
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const xdelo_reprocessMessage = async (req: Request, correlationId: string) => {
  const body = await req.json();
  const { messageId, forceReprocess = true } = body;
  
  if (!messageId) {
    throw new Error("Message ID is required");
  }

  console.log(`Reprocessing message ${messageId}, correlation ID: ${correlationId}, force_reprocess: ${forceReprocess}`);
  
  try {
    // Get the message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id, processing_state, analyzed_content')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'Unknown error'}`);
    }
    
    // Update the message to processing state
    await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Call direct-caption-processor with force_reprocess flag
    const { data: processorResult, error: processorError } = await supabase.functions.invoke(
      'direct-caption-processor',
      {
        body: {
          messageId,
          trigger_source: 'reprocess_function',
          force_reprocess: forceReprocess
        }
      }
    );
    
    if (processorError) {
      throw new Error(`Processing failed: ${processorError.message}`);
    }
    
    // Log the reprocessing
    await supabase.from('unified_audit_logs').insert({
      event_type: 'message_reprocessed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        previous_state: message.processing_state,
        had_analyzed_content: !!message.analyzed_content,
        media_group_id: message.media_group_id,
        force_reprocess: forceReprocess,
        trigger_source: 'xdelo_reprocess_message'
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Message ${messageId} reprocessed successfully`,
        data: processorResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error reprocessing message: ${error.message}`);
    
    // Update the message to error state
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: error.message,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'message_reprocess_error',
      entity_id: messageId,
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        error_stack: error.stack,
        force_reprocess: forceReprocess
      },
      event_timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};

serve(withErrorHandling('xdelo_reprocess_message', xdelo_reprocessMessage));

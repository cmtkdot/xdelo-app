
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const directCaptionProcessor = async (req: Request, correlationId: string) => {
  // Parse the request body
  const body = await req.json();
  const { messageId, trigger_source = 'database_trigger' } = body;
  
  if (!messageId) {
    throw new Error("Message ID is required");
  }

  console.log(`Direct caption processor triggered for message ${messageId}, correlation ID: ${correlationId}`);
  
  try {
    // Get the message details to check if it has a caption
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id, processing_state')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'Unknown error'}`);
    }
    
    // Skip processing if no caption or already processed
    if (!message.caption || message.processing_state === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Message ${messageId} skipped: ${!message.caption ? 'No caption' : 'Already processed'}`,
          correlation_id: correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing caption for message ${messageId}, caption length: ${message.caption.length}`);
    
    // Directly call the manual-caption-parser for simplicity and consistency
    const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
      'manual-caption-parser',
      {
        body: {
          messageId,
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlationId,
          trigger_source
        }
      }
    );
    
    if (analysisError) {
      throw new Error(`Analysis error: ${analysisError.message}`);
    }
    
    console.log(`Successfully processed caption for message ${messageId}`);
    
    // Log the direct processing
    await supabase.from('unified_audit_logs').insert({
      event_type: 'direct_caption_processor_success',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        result: analysisResult?.data || 'No data returned'
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption processed for message ${messageId}`,
        data: analysisResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error in direct caption processor: ${error.message}`);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'direct_caption_processor_error',
      entity_id: messageId,
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        error_stack: error.stack
      },
      event_timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};

// Wrap the handler with error handling
serve(withErrorHandling('direct-caption-processor', directCaptionProcessor));

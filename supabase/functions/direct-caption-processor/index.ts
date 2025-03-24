
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { xdelo_logProcessingEvent } from "../_shared/databaseOperations.ts";

interface CaptionRequest {
  messageId: string;
  caption?: string;
  correlationId?: string;
  isEdit?: boolean;
}

// Direct caption processor function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    
    // Parse the request body
    const { messageId, caption, correlationId, isEdit = false } = await req.json() as CaptionRequest;
    
    if (!messageId) {
      throw new Error("Missing required parameter: messageId");
    }
    
    // Generate a correlation ID if one isn't provided
    const corrId = correlationId || crypto.randomUUID().toString();
    
    // Log the start of processing
    await xdelo_logProcessingEvent(
      "direct_caption_processing_started",
      messageId,
      corrId,
      {
        isEdit,
        timestamp: new Date().toISOString(),
      }
    );
    
    // Call the database function to process the caption
    const { data, error } = await supabase.rpc(
      "xdelo_process_caption_workflow",
      {
        p_message_id: messageId,
        p_correlation_id: corrId,
        p_force: true
      }
    );
    
    if (error) {
      throw new Error(`Database processing error: ${error.message}`);
    }
    
    // Log successful processing
    await xdelo_logProcessingEvent(
      "direct_caption_processing_completed",
      messageId,
      corrId,
      {
        success: true,
        result: data,
        isEdit,
        timestamp: new Date().toISOString(),
      }
    );
    
    // Return the result
    return new Response(
      JSON.stringify({
        success: true,
        data,
        messageId,
        correlationId: corrId
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in direct-caption-processor:", errorMessage);
    
    // Log the error
    try {
      const messageId = await req.json().then((body: any) => body.messageId);
      if (messageId) {
        await xdelo_logProcessingEvent(
          "direct_caption_processing_error",
          messageId,
          crypto.randomUUID().toString(),
          { error: errorMessage },
          errorMessage
        );
      }
    } catch {
      // Ignore errors in error logging
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});

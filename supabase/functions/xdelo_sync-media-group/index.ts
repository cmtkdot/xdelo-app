
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { processMediaGroupSync, findBestCaptionSource } from "../_shared/mediaGroupSync.ts";
import { xdelo_logProcessingEvent } from "../_shared/databaseOperations.ts";

/**
 * Edge function to handle media group synchronization
 * This provides a reliable way to sync media groups asynchronously,
 * avoiding issues with database triggers and transaction conflicts
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for tracing
    const correlationId = crypto.randomUUID();
    
    // Parse request body
    const { mediaGroupId, sourceMessageId, forceSync = false } = await req.json();
    
    // Validate required parameters
    if (!mediaGroupId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required parameter: mediaGroupId",
          correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Log the sync request
    await xdelo_logProcessingEvent(
      "media_group_sync_requested",
      mediaGroupId,
      correlationId,
      {
        source_message_id: sourceMessageId,
        force_sync: forceSync
      }
    );
    
    let finalSourceMessageId = sourceMessageId;
    
    // If no source message ID provided, find the best one
    if (!finalSourceMessageId) {
      const findResult = await findBestCaptionSource(mediaGroupId, correlationId);
      
      if (!findResult.success) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Could not find a suitable caption message: ${findResult.error}`,
            correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      finalSourceMessageId = findResult.messageId;
      
      // Log the source message selection
      await xdelo_logProcessingEvent(
        "media_group_source_selected",
        mediaGroupId,
        correlationId,
        {
          source_message_id: finalSourceMessageId,
          reason: findResult.reason
        }
      );
    }
    
    // Process the media group synchronization
    const result = await processMediaGroupSync(
      mediaGroupId,
      finalSourceMessageId,
      correlationId
    );
    
    // Return the result
    return new Response(
      JSON.stringify({
        ...result,
        correlationId,
        mediaGroupId,
        sourceMessageId: finalSourceMessageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error processing media group sync:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

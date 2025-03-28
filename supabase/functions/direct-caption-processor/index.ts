
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { xdelo_parseCaption } from "../_shared/captionParsers.ts";
import { parseCaptionV2 } from "../_shared/captionParserV2.ts";
import { ParsedContent, ProcessingState } from "../_shared/types.ts";

const BATCH_SIZE = 5;
const PROCESSING_TIMEOUT_MINUTES = 5;

serve(async (req) => {
  try {
    // Support CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // For manual invocation, we can pass parameters
    const params = await parseRequest(req);
    
    // Get pending messages from the database
    const pendingMessages = await fetchPendingMessages(
      params.batchSize || BATCH_SIZE,
      params.specificIds
    );

    if (pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending messages to process"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Processing ${pendingMessages.length} pending messages`);
    
    // Process each pending message
    const results = await Promise.all(
      pendingMessages.map(message => processMessage(message, params.forceReprocess, params.enableDetailedLogs))
    );
    
    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: results.length,
        success_count: successCount,
        failure_count: failureCount,
        results: results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing captions:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Parse the request parameters
 */
async function parseRequest(req: Request): Promise<{
  batchSize?: number;
  specificIds?: string[];
  forceReprocess?: boolean;
  enableDetailedLogs?: boolean;
}> {
  try {
    const body = await req.json();
    return {
      batchSize: body.batchSize || BATCH_SIZE,
      specificIds: Array.isArray(body.messageIds) ? body.messageIds : undefined,
      forceReprocess: !!body.forceReprocess,
      enableDetailedLogs: !!body.enableDetailedLogs
    };
  } catch {
    return {
      batchSize: BATCH_SIZE,
      specificIds: undefined,
      forceReprocess: false,
      enableDetailedLogs: false
    };
  }
}

/**
 * Fetch pending messages that need caption processing
 */
async function fetchPendingMessages(
  batchSize: number = BATCH_SIZE,
  specificIds?: string[]
): Promise<any[]> {
  try {
    let query = supabaseClient
      .from("messages")
      .select("*")
      .eq("processing_state", "pending")
      .is("caption", "not.null")
      .order("created_at", { ascending: false })
      .limit(batchSize);
    
    // If specific IDs are provided, use them instead
    if (specificIds && specificIds.length > 0) {
      query = supabaseClient
        .from("messages")
        .select("*")
        .in("id", specificIds);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error fetching pending messages:", error);
    throw error;
  }
}

/**
 * Process a single message
 */
async function processMessage(
  message: any, 
  forceReprocess: boolean = false,
  enableDetailedLogs: boolean = false
): Promise<{
  success: boolean;
  message_id: string;
  error?: string;
  sync_status?: string;
  debug_info?: any;
}> {
  const startTime = Date.now();
  const debugInfo: any = {
    timestamps: {
      start: new Date().toISOString(),
    },
    steps: []
  };
  
  const logStep = (step: string, data?: any) => {
    if (enableDetailedLogs) {
      debugInfo.steps.push({
        step,
        timestamp: new Date().toISOString(),
        elapsed_ms: Date.now() - startTime,
        data
      });
    }
  };
  
  try {
    // Skip if no caption
    if (!message.caption) {
      logStep("caption_check", { has_caption: false });
      return {
        success: false,
        message_id: message.id,
        error: "No caption to process",
        debug_info: enableDetailedLogs ? debugInfo : undefined
      };
    }
    
    logStep("caption_check", { 
      has_caption: true, 
      caption: message.caption.substring(0, 50) + (message.caption.length > 50 ? "..." : "")
    });
    
    // Atomically update status to 'processing' to prevent double-processing
    logStep("attempt_lock");
    const { data: lockedMessage, error: lockError } = await supabaseClient
      .from("messages")
      .update({
        processing_state: "processing" as ProcessingState,
        processing_started_at: new Date().toISOString(),
        retry_count: message.retry_count ? message.retry_count + 1 : 1
      })
      .eq("id", message.id)
      .eq("processing_state", "pending") // Only update if still pending
      .select()
      .single();
    
    logStep("lock_result", { success: !lockError, error: lockError?.message });
    
    // If update failed, the message is likely being processed by another worker
    if (lockError || !lockedMessage) {
      return {
        success: false,
        message_id: message.id,
        error: lockError?.message || "Message already being processed by another worker",
        debug_info: enableDetailedLogs ? debugInfo : undefined
      };
    }
    
    // Process the caption
    logStep("start_parsing", { message_id: message.id });
    
    // Generate a correlation ID for tracking
    const correlationId = crypto.randomUUID();
    
    // Parse the caption using both the legacy and V2 parsers
    // This ensures backward compatibility while testing the new parser
    logStep("parse_legacy_start");
    const legacyResult = xdelo_parseCaption(message.caption, {
      messageId: message.id,
      correlationId: correlationId
    });
    logStep("parse_legacy_complete", { success: !!legacyResult });
    
    logStep("parse_v2_start");
    const v2Result = parseCaptionV2(message.caption, {
      messageId: message.id,
      correlationId: correlationId
    });
    logStep("parse_v2_complete", { success: !!v2Result });
    
    // Use V2 result as primary, but include legacy result for comparison
    const parsedContent: ParsedContent = {
      ...v2Result,
      parsing_metadata: {
        ...v2Result.parsing_metadata,
        legacy_result: legacyResult.parsing_metadata
      }
    };
    
    // Update the message with the parsed content
    logStep("update_message_start");
    const { error: updateError } = await supabaseClient
      .from("messages")
      .update({
        processing_state: "completed" as ProcessingState,
        analyzed_content: parsedContent,
        processing_completed_at: new Date().toISOString()
      })
      .eq("id", message.id);
    
    logStep("update_message_complete", { error: updateError?.message });
    
    if (updateError) {
      throw updateError;
    }
    
    // If it's part of a media group, sync the content to other messages in the group
    let syncStatus = "not_needed";
    if (message.media_group_id) {
      try {
        logStep("sync_group_start", { media_group_id: message.media_group_id });
        // Call RPC function to sync content to other messages in the group
        const { data: syncData, error: syncError } = await supabaseClient.rpc(
          "xdelo_sync_media_group_content",
          {
            p_message_id: message.id,
            p_analyzed_content: parsedContent,
            p_force_sync: forceReprocess,
            p_sync_edit_history: !!message.is_edited
          }
        );
        
        logStep("sync_group_complete", { 
          success: !syncError, 
          error: syncError?.message, 
          data: syncData 
        });
        
        if (syncError) {
          console.error(`Error syncing media group ${message.media_group_id}:`, syncError);
          syncStatus = "failed";
        } else {
          syncStatus = "success";
        }
      } catch (syncError) {
        console.error(`Exception syncing media group ${message.media_group_id}:`, syncError);
        syncStatus = "exception";
        logStep("sync_group_exception", { error: syncError instanceof Error ? syncError.message : String(syncError) });
      }
    }
    
    // Log the successful processing
    logStep("logging_audit", { correlation_id: correlationId });
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: "caption_processed",
      entity_type: "message",
      entity_id: message.id,
      correlation_id: correlationId,
      metadata: {
        media_group_id: message.media_group_id,
        sync_status: syncStatus,
        is_edited: !!message.is_edited,
        processing_method: "direct-processor",
        timestamp: new Date().toISOString()
      }
    });
    
    debugInfo.timestamps.end = new Date().toISOString();
    debugInfo.total_duration_ms = Date.now() - startTime;
    
    return {
      success: true,
      message_id: message.id,
      sync_status: syncStatus,
      debug_info: enableDetailedLogs ? debugInfo : undefined
    };
  } catch (error) {
    console.error(`Error processing message ${message.id}:`, error);
    logStep("processing_error", { error: error instanceof Error ? error.message : String(error) });
    
    // Update message to error state
    try {
      logStep("update_to_error_state");
      await supabaseClient
        .from("messages")
        .update({
          processing_state: "error" as ProcessingState,
          error_message: error instanceof Error ? error.message : String(error),
          last_error_at: new Date().toISOString()
        })
        .eq("id", message.id);
    } catch (updateError) {
      console.error(`Error updating message ${message.id} to error state:`, updateError);
      logStep("error_update_failed", { error: updateError instanceof Error ? updateError.message : String(updateError) });
    }
    
    debugInfo.timestamps.end = new Date().toISOString();
    debugInfo.total_duration_ms = Date.now() - startTime;
    
    return {
      success: false,
      message_id: message.id,
      error: error instanceof Error ? error.message : String(error),
      debug_info: enableDetailedLogs ? debugInfo : undefined
    };
  }
}

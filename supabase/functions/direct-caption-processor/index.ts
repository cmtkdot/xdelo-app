
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ParsedContent, ProcessingState } from "../_shared/types.ts";

// Create a Supabase client
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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
    let params: any = {};
    if (req.method === "POST") {
      try {
        params = await req.json();
      } catch {
        params = {};
      }
    }
    
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
      pendingMessages.map(message => processMessage(message, params.forceReprocess))
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
        error: error instanceof Error ? error.message : "An unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

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
  forceReprocess: boolean = false
): Promise<{
  success: boolean;
  message_id: string;
  error?: string;
  sync_status?: string;
}> {
  try {
    // Skip if no caption
    if (!message.caption) {
      return {
        success: false,
        message_id: message.id,
        error: "No caption to process"
      };
    }
    
    // Atomically update status to 'processing' to prevent double-processing
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
    
    // If update failed, the message is likely being processed by another worker
    if (lockError || !lockedMessage) {
      return {
        success: false,
        message_id: message.id,
        error: lockError?.message || "Message already being processed by another worker"
      };
    }
    
    // Call parse-caption function to process the caption
    const parseResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-caption`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          messageId: message.id,
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlationId: message.correlation_id || crypto.randomUUID(),
          isEdit: message.is_edited,
          retryCount: message.retry_count || 0,
          force_reprocess: forceReprocess
        })
      }
    );

    if (!parseResponse.ok) {
      // Parse the error if possible
      let errorMessage = "Failed to parse caption";
      try {
        const errorData = await parseResponse.json();
        errorMessage = errorData.error || errorMessage;
      } catch {}

      // Update message to error state
      await supabaseClient
        .from("messages")
        .update({
          processing_state: "error" as ProcessingState,
          error_message: errorMessage,
          last_error_at: new Date().toISOString()
        })
        .eq("id", message.id);

      return {
        success: false,
        message_id: message.id,
        error: errorMessage
      };
    }

    const result = await parseResponse.json();
    
    return {
      success: true,
      message_id: message.id,
      sync_status: result.sync_result ? "success" : "not_needed"
    };
  } catch (error) {
    console.error(`Error processing message ${message.id}:`, error);
    
    // Update message to error state
    try {
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
    }
    
    return {
      success: false,
      message_id: message.id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

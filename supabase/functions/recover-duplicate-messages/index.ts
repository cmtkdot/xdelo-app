
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { recoverDuplicateFileMessages } from "../telegram-webhook/dbOperations.ts";
import { xdelo_logProcessingEvent } from "../_shared/databaseOperations.ts";

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = crypto.randomUUID();
    
    // Log start of recovery process
    await xdelo_logProcessingEvent(
      "recovery_process_started",
      "system",
      correlationId,
      {
        recovery_type: "duplicate_file_id",
        timestamp: new Date().toISOString(),
      }
    );
    
    // Run recovery function
    const result = await recoverDuplicateFileMessages(correlationId);
    
    // Log completion
    await xdelo_logProcessingEvent(
      "recovery_process_completed",
      "system",
      correlationId,
      {
        recovered: result.recovered,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        recovered: result.recovered,
        errors: result.errors,
        correlation_id: correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in recovery process:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

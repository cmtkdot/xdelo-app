
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const executeDatabaseMigration = async (req: Request, correlationId: string) => {
  const { limit = 100 } = await req.json();

  // Execute RPC function to standardize storage paths
  const { data, error } = await supabaseClient.rpc(
    'xdelo_fix_storage_paths',
    { p_limit: limit }
  );

  if (error) {
    throw new Error(`Failed to standardize storage paths: ${error.message}`);
  }

  const successful = Array.isArray(data) ? data.length : 0;
  const failed = 0; // We don't get failed counts from the RPC function

  return new Response(
    JSON.stringify({
      success: true,
      successful,
      failed,
      message: `Successfully standardized ${successful} storage paths`,
      correlation_id: correlationId,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
};

// Use the error handling wrapper
const handler = withErrorHandling("xdelo_standardize_storage_paths", executeDatabaseMigration);
Deno.serve(handler);

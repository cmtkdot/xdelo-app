
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const fixMediaUrls = async (req: Request, correlationId: string) => {
  const { limit = 100 } = await req.json();

  // Execute RPC function to fix media URLs
  const { data, error } = await supabaseClient.rpc(
    'xdelo_fix_public_urls',
    { p_limit: limit }
  );

  if (error) {
    throw new Error(`Failed to fix media URLs: ${error.message}`);
  }

  const fixedCount = Array.isArray(data) ? data.length : 0;

  return new Response(
    JSON.stringify({
      success: true,
      fixed_count: fixedCount,
      message: `Successfully fixed ${fixedCount} media URLs`,
      correlation_id: correlationId,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
};

// Use the error handling wrapper
const handler = withErrorHandling("xdelo_fix_media_urls", fixMediaUrls);
Deno.serve(handler);

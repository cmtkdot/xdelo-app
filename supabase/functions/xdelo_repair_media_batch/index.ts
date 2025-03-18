
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const repairMediaBatch = async (req: Request, correlationId: string) => {
  const { messageIds } = await req.json();

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("No message IDs provided");
  }

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process each message ID
  for (const messageId of messageIds) {
    try {
      // Call the RPC function to repair the file
      const { data, error } = await supabaseClient.rpc(
        'xdelo_repair_file',
        { 
          p_message_id: messageId,
          p_action: 'repair_media'
        }
      );

      if (error) {
        throw new Error(`Failed to repair message ${messageId}: ${error.message}`);
      }

      if (data && data.success) {
        successful++;
      } else {
        failed++;
        errors.push(`Message ${messageId}: ${data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      failed++;
      errors.push(`Message ${messageId}: ${error.message || 'Unknown error'}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: successful > 0,
      successful,
      failed,
      total: messageIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Repaired ${successful} of ${messageIds.length} files`,
      correlation_id: correlationId,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
};

// Use the error handling wrapper
const handler = withErrorHandling("xdelo_repair_media_batch", repairMediaBatch);
Deno.serve(handler);

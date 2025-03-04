
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const syncMediaGroupHandler = async (req: Request, correlationId: string) => {
  // Safely parse the request body
  const { mediaGroupId, sourceMessageId, forceSync = false } = await req.json();
  
  if (!mediaGroupId || !sourceMessageId) {
    throw new Error("Media group ID and source message ID are required");
  }

  console.log(`Syncing media group ${mediaGroupId} from message ${sourceMessageId}`);

  // Call the database function to sync media group content
  const { data, error } = await supabase.rpc(
    'xdelo_sync_media_group_content',
    {
      p_source_message_id: sourceMessageId,
      p_media_group_id: mediaGroupId,
      p_correlation_id: correlationId,
      p_force_sync: forceSync
    }
  );

  if (error) {
    throw new Error(`Error syncing media group: ${error.message}`);
  }

  // Log the successful sync
  await supabase.from('unified_audit_logs').insert({
    event_type: 'media_group_sync_completed',
    entity_id: sourceMessageId,
    correlation_id: correlationId,
    metadata: {
      ...data,
      media_group_id: mediaGroupId,
      sync_method: 'edge_function'
    },
    event_timestamp: new Date().toISOString()
  });

  return new Response(
    JSON.stringify({
      success: true,
      data,
      correlation_id: correlationId
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

// Wrap the handler with standardized error handling
serve(withErrorHandling('xdelo_sync_media_group', syncMediaGroupHandler));

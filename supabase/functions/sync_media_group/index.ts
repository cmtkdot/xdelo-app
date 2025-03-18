
// Supabase Edge Function to sync media group content
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      mediaGroupId,
      sourceMessageId,
      correlationId = crypto.randomUUID().toString(),
      forceSync = false,
      syncEditHistory = false
    } = await req.json();

    console.log(`Processing media group sync: ${mediaGroupId} from source ${sourceMessageId}`);

    if (!mediaGroupId) {
      throw new Error("Missing required parameter: mediaGroupId");
    }

    if (!sourceMessageId) {
      throw new Error("Missing required parameter: sourceMessageId");
    }

    // Call the database function to sync media group content
    const { data, error } = await supabaseClient.rpc(
      'sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync
      }
    );

    if (error) {
      throw new Error(`Database function error: ${error.message}`);
    }

    // If syncEditHistory is true, also sync the edit history
    if (syncEditHistory) {
      try {
        // Get the source message edit history
        const { data: sourceMessage } = await supabaseClient
          .from('messages')
          .select('edit_history')
          .eq('id', sourceMessageId)
          .single();

        if (sourceMessage?.edit_history) {
          // Update all other messages in the media group with this edit history
          const { error: updateError } = await supabaseClient
            .from('messages')
            .update({ 
              edit_history: sourceMessage.edit_history,
              is_edited: true
            })
            .eq('media_group_id', mediaGroupId)
            .neq('id', sourceMessageId);

          if (updateError) {
            console.error('Error syncing edit history:', updateError);
          }
        }
      } catch (historyError) {
        console.error('Error syncing edit history:', historyError);
        // Continue - this is a non-critical operation
      }
    }

    // Log the sync operation
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'sync_media_group_edge_function',
        entity_id: sourceMessageId,
        correlation_id: correlationId,
        metadata: {
          media_group_id: mediaGroupId,
          force_sync: forceSync,
          sync_edit_history: syncEditHistory,
          result: data
        },
        event_timestamp: new Date().toISOString()
      });

    // Return the sync result
    return new Response(
      JSON.stringify({
        success: true,
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId,
        synced_count: data?.synced_messages || 0,
        force_sync: forceSync
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing media group:', error);

    // Try to log the error
    try {
      const { sourceMessageId, mediaGroupId, correlationId } = await req.json();
      await supabaseClient
        .from('unified_audit_logs')
        .insert({
          event_type: 'sync_media_group_error',
          entity_id: sourceMessageId || 'unknown',
          error_message: error.message,
          metadata: {
            media_group_id: mediaGroupId,
            correlation_id: correlationId || crypto.randomUUID().toString()
          },
          correlation_id: correlationId || crypto.randomUUID().toString(),
          event_timestamp: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

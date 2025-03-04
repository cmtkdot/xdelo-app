
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
  const { mediaGroupId, sourceMessageId, forceSync = false, syncEditHistory = false } = await req.json();
  
  if (!mediaGroupId || !sourceMessageId) {
    throw new Error("Media group ID and source message ID are required");
  }

  console.log(`Syncing media group ${mediaGroupId} from message ${sourceMessageId}, correlation ID: ${correlationId}, syncEditHistory: ${syncEditHistory}`);

  let result;
  
  try {
    // First try to use the improved database function with advisory locks
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );

    if (error) {
      throw new Error(`Error syncing media group: ${error.message}`);
    }
    
    result = data;
    console.log(`Successfully synced media group ${mediaGroupId}:`, result);
  } catch (error) {
    console.error(`Database sync error, trying fallback: ${error.message}`);
    
    // Fallback: direct update if database function fails
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('id, analyzed_content, old_analyzed_content')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage?.analyzed_content) {
      throw new Error(`Error fetching source message: ${sourceError?.message || "No analyzed content"}`);
    }
    
    // Update data with optional edit history
    const updateData: any = {
      analyzed_content: sourceMessage.analyzed_content,
      message_caption_id: sourceMessageId,
      is_original_caption: false,
      group_caption_synced: true,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Include edit history if requested
    if (syncEditHistory && sourceMessage.old_analyzed_content) {
      updateData.old_analyzed_content = sourceMessage.old_analyzed_content;
    }
    
    // Update all other messages in the group
    const { data: updateResult, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
      
    if (updateError) {
      throw new Error(`Error updating media group: ${updateError.message}`);
    }
    
    result = {
      success: true,
      message: 'Media group content synced (fallback method)',
      updated_count: updateResult.length,
      source_message_id: sourceMessageId,
      sync_edit_history: syncEditHistory
    };
  }

  // Log the successful sync
  await supabase.from('unified_audit_logs').insert({
    event_type: 'media_group_sync_completed',
    entity_id: sourceMessageId,
    correlation_id: correlationId,
    metadata: {
      ...result,
      media_group_id: mediaGroupId,
      sync_method: 'edge_function',
      forced: forceSync,
      sync_edit_history: syncEditHistory
    },
    event_timestamp: new Date().toISOString()
  });

  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      correlation_id: correlationId
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

// Wrap the handler with standardized error handling
serve(withErrorHandling('xdelo_sync_media_group', syncMediaGroupHandler));

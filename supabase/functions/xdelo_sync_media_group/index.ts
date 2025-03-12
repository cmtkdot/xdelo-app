
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SyncMediaGroupRequest {
  mediaGroupId: string;
  sourceMessageId: string;
  correlationId?: string;
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json() as SyncMediaGroupRequest;
    const { mediaGroupId, sourceMessageId, correlationId, forceSync = false, syncEditHistory = false } = requestData;

    if (!mediaGroupId || !sourceMessageId) {
      throw new Error('Missing required parameters: mediaGroupId and sourceMessageId are required');
    }

    console.log(`Syncing media group ${mediaGroupId} from source message ${sourceMessageId}`, {
      forceSync,
      syncEditHistory,
      correlationId
    });

    // First, get the source message with its analyzed content
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, media_group_id, edit_history')
      .eq('id', sourceMessageId)
      .single();
    
    if (sourceError || !sourceMessage) {
      throw new Error(`Source message not found: ${sourceError?.message || 'No data returned'}`);
    }

    if (!sourceMessage.analyzed_content) {
      throw new Error('Source message has no analyzed content to sync');
    }

    if (sourceMessage.media_group_id !== mediaGroupId) {
      throw new Error(`Source message ${sourceMessageId} is not part of media group ${mediaGroupId}`);
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      analyzed_content: sourceMessage.analyzed_content,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      group_caption_synced: true,
      updated_at: new Date().toISOString()
    };

    // Include edit history if requested
    if (syncEditHistory && sourceMessage.edit_history) {
      updateData.edit_history = sourceMessage.edit_history;
    }

    // Update all other messages in the group
    const { data: updateResult, error: updateError } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId)
      .select('id');

    if (updateError) {
      throw new Error(`Failed to update media group messages: ${updateError.message}`);
    }

    // Log the sync operation
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_content_synced',
      entity_id: sourceMessageId,
      correlation_id: correlationId || crypto.randomUUID(),
      metadata: {
        media_group_id: mediaGroupId,
        synced_messages: updateResult?.length || 0,
        source_message_id: sourceMessageId,
        forced_sync: forceSync,
        synced_edit_history: syncEditHistory,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: updateResult?.length || 0,
        media_group_id: mediaGroupId,
        source_message_id: sourceMessageId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error syncing media group:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

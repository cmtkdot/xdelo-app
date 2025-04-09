import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_findMediaGroupMessages } from "../_shared/messageUtils.ts";

/**
 * Creates a Supabase client with the environment variables
 * @returns {SupabaseClient} A configured Supabase client
 */
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Syncs analyzed content from a source message to all other messages in the same media group
 * @param {Request} req - The HTTP request object
 * @returns {Response} HTTP response with sync results
 */
async function handleMediaGroupSync(req: Request): Promise<Response> {
  const {
    mediaGroupId,
    sourceMessageId,
    correlationId = crypto.randomUUID(),
    forceSync = false,
    syncEditHistory = false
  } = await req.json();
  
  console.log(`[${correlationId}] Syncing media group ${mediaGroupId} from source ${sourceMessageId}`);
  
  try {
    // 1. Get source message content
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, edit_history, old_analyzed_content')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage || !sourceMessage.analyzed_content) {
      throw new Error(`Source message not found or has no analyzed content: ${sourceError?.message || 'No content'}`);
    }
    
    // 2. Find all other messages in the same group
    const groupMessages = await xdelo_findMediaGroupMessages(mediaGroupId, sourceMessageId);
    
    if (!groupMessages.length) {
      return new Response(
        JSON.stringify({
          success: true,
          synced_count: 0,
          message: 'No other messages in group to sync'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 3. Update all messages with content from source
    const updates = [];
    for (const message of groupMessages) {
      const updateData: any = {
        analyzed_content: sourceMessage.analyzed_content,
        group_caption_synced: true,
        is_original_caption: false,
        updated_at: new Date().toISOString()
      };
      
      // Sync edit history if requested
      if (syncEditHistory && sourceMessage.edit_history) {
        updateData.edit_history = sourceMessage.edit_history;
        updateData.old_analyzed_content = sourceMessage.old_analyzed_content;
      }
      
      const { error } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', message.id);
        
      if (error) {
        console.error(`[${correlationId}] Error updating message ${message.id}: ${error.message}`);
      } else {
        updates.push(message.id);
      }
    }
    
    // 4. Log the sync event
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_content_synced',
      entity_id: mediaGroupId,
      metadata: {
        source_message_id: sourceMessageId,
        target_message_ids: updates,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        sync_edit_history: syncEditHistory
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        synced_count: updates.length,
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error in media group sync: ${error.message}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        media_group_id: mediaGroupId
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Expose the edge function
serve(handleMediaGroupSync);

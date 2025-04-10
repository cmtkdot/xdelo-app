/**
 * media_group_sync_cron/index.ts
 * 
 * Cron job to find and sync media group messages with missing/inconsistent analyzed_content.
 * This ensures data consistency even for messages that might have been missed
 * during normal processing.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { Database } from "../_shared/types.ts";

// Types for sync operations
interface MessageGroupInfo {
  mediaGroupId: string;
  messageCount: number;
  syncableMessages: number;
  needsSyncMessages: number;
  bestSourceId: string | null;
}

interface SyncResult {
  mediaGroupId: string;
  messagesUpdated: number;
  sourceMessageId: string;
}

const BATCH_SIZE = 50; // Process this many media groups at a time

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Create Supabase client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient<Database>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Define correlation ID for tracking
    const correlationId = crypto.randomUUID();
    console.log(`[${correlationId}] Starting media group sync cron job`);

    // Find media groups that need syncing
    const groupsToSync = await findMediaGroupsNeedingSync(supabaseClient, BATCH_SIZE);
    
    if (groupsToSync.length === 0) {
      console.log(`[${correlationId}] No inconsistent media groups found`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No inconsistent media groups found",
          groupsProcessed: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Process each group
    const syncResults: SyncResult[] = [];
    
    for (const group of groupsToSync) {
      if (!group.bestSourceId) {
        console.log(`[${correlationId}] Cannot sync group ${group.mediaGroupId} - no valid source message`);
        continue;
      }
      
      const result = await syncMediaGroup(
        supabaseClient, 
        group.mediaGroupId, 
        group.bestSourceId,
        correlationId
      );
      
      syncResults.push({
        mediaGroupId: group.mediaGroupId,
        messagesUpdated: result.messagesUpdated,
        sourceMessageId: group.bestSourceId
      });
    }
    
    // Log and return results
    console.log(`[${correlationId}] Completed sync cron job, processed ${syncResults.length} media groups`);
    
    return new Response(
      JSON.stringify({
        success: true,
        groupsProcessed: syncResults.length,
        totalMessagesUpdated: syncResults.reduce((sum, r) => sum + r.messagesUpdated, 0),
        details: syncResults,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
    
  } catch (error) {
    console.error("Error processing cron job:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Finds media groups with inconsistent analyzed_content 
 */
async function findMediaGroupsNeedingSync(
  supabaseClient: ReturnType<typeof createClient<Database>>,
  limit: number
): Promise<MessageGroupInfo[]> {
  
  const { data, error } = await supabaseClient.rpc('find_inconsistent_media_groups', {
    p_limit: limit
  });
  
  if (error) {
    console.error("Error finding inconsistent media groups:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Synchronizes a media group using the best source message
 */
async function syncMediaGroup(
  supabaseClient: ReturnType<typeof createClient<Database>>,
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
): Promise<{messagesUpdated: number}> {
  
  // First get the source message details
  const { data: sourceMessage, error: sourceError } = await supabaseClient
    .from('messages')
    .select('caption, analyzed_content')
    .eq('id', sourceMessageId)
    .single();
  
  if (sourceError || !sourceMessage) {
    console.error(`[${correlationId}] Error retrieving source message:`, sourceError);
    return { messagesUpdated: 0 };
  }
  
  // Call the sync_media_group_captions function
  const { data: updatedIds, error: syncError } = await supabaseClient
    .rpc('sync_media_group_captions', {
      p_media_group_id: mediaGroupId,
      p_exclude_message_id: sourceMessageId,
      p_caption: sourceMessage.caption,
      p_caption_data: sourceMessage.analyzed_content,
      p_processing_state: 'processed' // Use 'processed' since this is a recovery operation
    });
    
  if (syncError) {
    console.error(`[${correlationId}] Error syncing media group:`, syncError);
    return { messagesUpdated: 0 };
  }
  
  // Log the sync to unified_audit_logs
  await supabaseClient.from('unified_audit_logs').insert({
    action_type: 'cron_media_group_sync',
    table_name: 'messages',
    record_id: sourceMessageId,
    action_data: {
      media_group_id: mediaGroupId,
      correlation_id: correlationId,
      messages_updated: Array.isArray(updatedIds) ? updatedIds.length : 0,
      source_message_id: sourceMessageId
    }
  });
  
  return { 
    messagesUpdated: Array.isArray(updatedIds) ? updatedIds.length : 0 
  };
}

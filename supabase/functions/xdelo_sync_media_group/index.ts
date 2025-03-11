
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

  console.log(`Syncing media group ${mediaGroupId} from message ${sourceMessageId}, correlation ID: ${correlationId}, syncEditHistory: ${syncEditHistory}, forceSync: ${forceSync}`);

  try {
    // First try to use the improved database function with advisory locks
    console.log('Using database function with advisory locks for sync operation');
    
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
    
    // Log the successful sync
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_synced',
      entity_id: sourceMessageId,
      correlation_id: correlationId,
      metadata: {
        ...data,
        media_group_id: mediaGroupId,
        sync_method: 'edge_function',
        forced: forceSync,
        sync_edit_history: syncEditHistory
      },
      event_timestamp: new Date().toISOString()
    });
    
    console.log(`Successfully synced media group ${mediaGroupId}:`, data);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (databaseError) {
    console.error(`Database sync error, trying fallback: ${databaseError.message}`);
    
    try {
      // Fallback: direct database operations if the RPC function fails
      console.log('Using direct database operations as fallback');
      
      // 1. Get the source message
      const { data: sourceMessage, error: sourceError } = await supabase
        .from('messages')
        .select('id, analyzed_content, old_analyzed_content')
        .eq('id', sourceMessageId)
        .single();
        
      if (sourceError || !sourceMessage?.analyzed_content) {
        throw new Error(`Error fetching source message: ${sourceError?.message || "No analyzed content"}`);
      }
      
      // 2. Mark source message as the original caption holder
      const { error: updateSourceError } = await supabase
        .from('messages')
        .update({
          is_original_caption: true,
          group_caption_synced: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', sourceMessageId);
        
      if (updateSourceError) {
        console.warn(`Warning: Failed to update source message: ${updateSourceError.message}`);
      }
      
      // 3. Update data for target messages
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
      
      // 4. Update all other messages in the group
      const { data: updateResult, error: updateError } = await supabase
        .from('messages')
        .update(updateData)
        .eq('media_group_id', mediaGroupId)
        .neq('id', sourceMessageId)
        .select('id');
        
      if (updateError) {
        throw new Error(`Error updating media group: ${updateError.message}`);
      }
      
      // 5. Update group metadata
      const { data: statsResult, error: statsError } = await supabase
        .from('messages')
        .select('id, created_at')
        .eq('media_group_id', mediaGroupId)
        .order('created_at', { ascending: true });
        
      if (!statsError && statsResult) {
        const firstMessageTime = statsResult.length > 0 ? statsResult[0].created_at : null;
        const lastMessageTime = statsResult.length > 0 ? statsResult[statsResult.length - 1].created_at : null;
        
        await supabase
          .from('messages')
          .update({
            group_message_count: statsResult.length,
            group_first_message_time: firstMessageTime,
            group_last_message_time: lastMessageTime,
            updated_at: new Date().toISOString()
          })
          .eq('media_group_id', mediaGroupId);
      }
      
      // 6. Log the fallback sync
      await supabase.from('unified_audit_logs').insert({
        event_type: 'media_group_synced_fallback',
        entity_id: sourceMessageId,
        correlation_id: correlationId,
        metadata: {
          media_group_id: mediaGroupId,
          sync_method: 'edge_function_fallback',
          updated_count: updateResult?.length || 0,
          forced: forceSync,
          sync_edit_history: syncEditHistory,
          original_error: databaseError.message
        },
        event_timestamp: new Date().toISOString()
      });
      
      const result = {
        success: true,
        message: 'Media group content synced (fallback method)',
        updated_count: updateResult?.length || 0,
        source_message_id: sourceMessageId,
        sync_edit_history: syncEditHistory
      };
      
      console.log(`Successfully synced media group ${mediaGroupId} using fallback:`, result);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          correlation_id: correlationId,
          method: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fallbackError) {
      console.error(`Fallback sync also failed: ${fallbackError.message}`);
      
      // Log the error
      await supabase.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_error',
        entity_id: sourceMessageId,
        error_message: `Database error: ${databaseError.message}, Fallback error: ${fallbackError.message}`,
        correlation_id: correlationId,
        metadata: {
          media_group_id: mediaGroupId,
          sync_method: 'edge_function_both_failed',
          forced: forceSync,
          sync_edit_history: syncEditHistory
        },
        event_timestamp: new Date().toISOString()
      });
      
      throw new Error(`Failed to sync media group after multiple attempts: ${fallbackError.message}`);
    }
  }
};

// Wrap the handler with standardized error handling
serve(withErrorHandling('xdelo_sync_media_group', syncMediaGroupHandler));


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { 
      mediaGroupId, 
      sourceMessageId, 
      correlationId = crypto.randomUUID(), 
      forceSync = false,
      syncEditHistory = false
    } = await req.json();
    
    if (!mediaGroupId || !sourceMessageId) {
      throw new Error('mediaGroupId and sourceMessageId are required');
    }
    
    console.log(`Processing media group sync for group ${mediaGroupId}, source message ${sourceMessageId}`);
    
    // First try to use the database function
    try {
      const { data, error } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_media_group_id: mediaGroupId,
          p_source_message_id: sourceMessageId,
          p_correlation_id: correlationId,
          p_force_sync: forceSync,
          p_sync_edit_history: syncEditHistory
        }
      );
      
      if (error) {
        if (error.message?.includes('Could not find the function')) {
          console.warn('Database function not available, falling back to manual sync');
        } else {
          throw error;
        }
      } else {
        console.log('Media group sync completed via database function:', data);
        
        return new Response(
          JSON.stringify({
            success: true,
            synced_count: data.synced_count || 0,
            method: 'database_function'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (dbError) {
      console.error('Database function error:', dbError);
      // Fall through to manual sync
    }
    
    // Manual sync fallback
    console.log('Performing manual media group sync');
    
    // Get the source message with analyzed content
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('analyzed_content, caption')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage) {
      throw new Error(`Could not find source message: ${sourceError?.message || 'Not found'}`);
    }
    
    if (!sourceMessage.analyzed_content) {
      throw new Error('Source message has no analyzed content to sync');
    }
    
    // Add sync metadata to the content
    const syncedContent = {
      ...sourceMessage.analyzed_content,
      sync_metadata: {
        ...sourceMessage.analyzed_content.sync_metadata,
        media_group_id: mediaGroupId,
        sync_source_message_id: sourceMessageId,
        sync_timestamp: new Date().toISOString(),
        sync_correlation_id: correlationId
      }
    };
    
    // Get all messages in the group except the source
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('id, caption, analyzed_content')
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
      
    if (groupError) {
      throw new Error(`Error fetching group messages: ${groupError.message}`);
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced_count: 0,
          method: 'manual_sync',
          message: 'No other messages in group to sync'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare updates for all other messages in the group
    const updatePromises = groupMessages.map(async (message) => {
      const updates = {
        analyzed_content: syncedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true,
        is_original_caption: false,
        message_caption_id: sourceMessageId,
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('messages')
        .update(updates)
        .eq('id', message.id);
        
      return { id: message.id, success: !updateError, error: updateError?.message };
    });
    
    // Execute all updates
    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.success).length;
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_completed',
      entity_id: sourceMessageId,
      correlation_id: correlationId,
      metadata: {
        media_group_id: mediaGroupId,
        synced_count: successCount,
        total_count: groupMessages.length,
        method: 'manual_edge_function',
        force_sync: forceSync,
        sync_edit_history: syncEditHistory,
        results
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        synced_count: successCount,
        total_count: groupMessages.length,
        method: 'manual_edge_function',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing media group:', error);
    
    // Log the error
    try {
      const { mediaGroupId, sourceMessageId, correlationId } = await req.json();
      
      await supabase.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_error',
        entity_id: sourceMessageId || 'unknown',
        correlation_id: correlationId || crypto.randomUUID(),
        error_message: error.message,
        metadata: {
          media_group_id: mediaGroupId,
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging failure:', logError);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

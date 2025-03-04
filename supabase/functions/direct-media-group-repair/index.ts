
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const directMediaGroupRepair = async (req: Request, correlationId: string) => {
  // Parse the request body
  const body = await req.json();
  const { repair_type = 'standard', group_id, message_id } = body;
  
  console.log(`Direct media group repair triggered, type: ${repair_type}, correlation ID: ${correlationId}`);
  
  try {
    let repairResult;
    let fixedCount = 0;
    
    // Handle different types of repairs
    if (repair_type === 'full') {
      // Full repair of all media groups
      console.log('Starting full repair of all media groups...');
      
      // 1. Find and fix groups with mixed processing states
      const { data: mixedStateGroups } = await supabase.rpc('xdelo_find_broken_media_groups');
      
      // 2. Process each broken group
      if (mixedStateGroups && mixedStateGroups.length > 0) {
        for (const group of mixedStateGroups) {
          if (group.media_group_id && group.source_message_id) {
            console.log(`Repairing group ${group.media_group_id} using source message ${group.source_message_id}`);
            
            try {
              const { data: syncResult } = await supabase.rpc(
                'xdelo_sync_media_group_content',
                {
                  p_source_message_id: group.source_message_id,
                  p_media_group_id: group.media_group_id,
                  p_correlation_id: correlationId,
                  p_force_sync: true,
                  p_sync_edit_history: true
                }
              );
              
              if (syncResult && syncResult.success) {
                fixedCount++;
              }
            } catch (syncError) {
              console.error(`Error repairing group ${group.media_group_id}:`, syncError.message);
            }
          }
        }
      }
      
      // 3. Find pending messages without captions in media groups that have analyzed content
      const { data: pendingMessages } = await supabase.from('messages')
        .select('id, media_group_id')
        .eq('processing_state', 'pending')
        .is('caption', null)
        .not('media_group_id', 'is', null);
      
      if (pendingMessages && pendingMessages.length > 0) {
        const processedGroups = new Set();
        
        for (const message of pendingMessages) {
          // Only process each group once
          if (message.media_group_id && !processedGroups.has(message.media_group_id)) {
            processedGroups.add(message.media_group_id);
            
            // Find a caption message in this group to use as source
            const { data: sourceMessage } = await supabase
              .from('messages')
              .select('id')
              .eq('media_group_id', message.media_group_id)
              .not('caption', 'is', null)
              .not('analyzed_content', 'is', null)
              .eq('is_original_caption', true)
              .limit(1)
              .single();
            
            if (sourceMessage) {
              console.log(`Repairing group ${message.media_group_id} with source message ${sourceMessage.id}`);
              
              try {
                const { data: syncResult } = await supabase.rpc(
                  'xdelo_sync_media_group_content',
                  {
                    p_source_message_id: sourceMessage.id,
                    p_media_group_id: message.media_group_id,
                    p_correlation_id: correlationId,
                    p_force_sync: true,
                    p_sync_edit_history: true
                  }
                );
                
                if (syncResult && syncResult.success) {
                  fixedCount++;
                }
              } catch (syncError) {
                console.error(`Error repairing group ${message.media_group_id}:`, syncError.message);
              }
            }
          }
        }
      }
      
      repairResult = { fixed_count: fixedCount, repair_type: 'full' };
    } 
    else if (repair_type === 'specific' && group_id) {
      // Repair a specific media group
      if (!message_id) {
        // Find the best source message
        const { data: sourceMessage } = await supabase.rpc('xdelo_find_caption_message', { p_media_group_id: group_id });
        
        if (sourceMessage) {
          message_id = sourceMessage;
        } else {
          throw new Error(`No suitable source message found for group ${group_id}`);
        }
      }
      
      console.log(`Repairing specific group ${group_id} using message ${message_id}`);
      
      const { data: syncResult } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_source_message_id: message_id,
          p_media_group_id: group_id,
          p_correlation_id: correlationId,
          p_force_sync: true,
          p_sync_edit_history: true
        }
      );
      
      repairResult = syncResult;
      fixedCount = syncResult?.updated_count || 0;
    }
    else {
      // Standard repair - use the database repair function
      console.log('Running standard repair using xdelo_repair_media_group_syncs...');
      
      const { data: dbRepairResult } = await supabase.rpc('xdelo_repair_media_group_syncs');
      
      repairResult = { 
        repair_results: dbRepairResult,
        repair_type: 'standard'
      };
      
      fixedCount = dbRepairResult?.length || 0;
    }
    
    // Log the repair operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_repair_completed',
      correlation_id: correlationId,
      metadata: {
        repair_type,
        fixed_count: fixedCount,
        group_id: group_id || 'all',
        source_message_id: message_id
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        fixed_count: fixedCount,
        repair_type,
        repair_result: repairResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error in direct media group repair: ${error.message}`);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_repair_error',
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        repair_type,
        group_id: group_id || 'all',
        source_message_id: message_id,
        error_stack: error.stack
      },
      event_timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};

// Wrap the handler with error handling
serve(withErrorHandling('direct-media-group-repair', directMediaGroupRepair));

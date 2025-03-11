
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 20, repair_enums = true, reset_all = false, force_reset_stalled = false } = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`Starting to repair processing flow, correlation ID: ${correlationId}, params:`, {
      limit, repair_enums, reset_all, force_reset_stalled
    });
    
    // Track operations and results
    const operations = [];
    const results = {
      stuck_reset: 0,
      initialized_processed: 0,
      media_groups_fixed: 0,
      enum_repair: null,
      diagnostics: null
    };
    
    // 1. First check if we need to repair enum values
    if (repair_enums) {
      try {
        operations.push('Repairing enum values');
        // Try to add missing enum values first
        await supabaseClient.rpc('xdelo_ensure_event_types_exist');
        console.log('Enum values checked/repaired');
        results.enum_repair = { success: true };
      } catch (enumError) {
        console.warn('Could not repair enums, proceeding with message repair only:', enumError);
        results.enum_repair = { success: false, error: enumError.message };
      }
    }
    
    // 2. Diagnostics to track the before state
    try {
      operations.push('Running diagnostics');
      const { data: beforeStats } = await supabaseClient.rpc('xdelo_get_message_processing_stats');
      results.diagnostics = { before: beforeStats };
    } catch (diagError) {
      console.warn('Could not get message processing stats:', diagError);
    }
    
    // 3. If reset_all is true or force_reset_stalled is true, use the function to reset stuck messages
    if (reset_all || force_reset_stalled) {
      try {
        operations.push('Resetting all stuck messages');
        const resetFunction = force_reset_stalled 
          ? 'xdelo_reset_stalled_messages' 
          : 'xdelo_reset_all_stuck_messages';
        
        const { data: resetData, error: resetError } = await supabaseClient.rpc(resetFunction);
        
        if (resetError) {
          throw new Error(`Error resetting stuck messages: ${resetError.message}`);
        }
        
        results.stuck_reset = resetData?.length || 0;
        console.log(`Reset ${results.stuck_reset} stuck messages`);
        
        // Also repair orphaned media group messages
        operations.push('Repairing orphaned media groups');
        const { data: orphanedData, error: orphanedError } = await supabaseClient.rpc('xdelo_repair_orphaned_media_group_messages');
        
        if (orphanedError) {
          console.warn(`Warning: Could not repair orphaned media group messages: ${orphanedError.message}`);
        } else {
          results.media_groups_fixed = orphanedData?.length || 0;
          console.log(`Fixed ${results.media_groups_fixed} orphaned media groups`);
        }
      } catch (resetAllError) {
        console.error('Error in batch reset operation:', resetAllError);
        throw resetAllError;
      }
    } else {
      // 4. Otherwise, find and process specific stuck messages
      operations.push('Processing specific stuck messages');
      
      // Find messages stuck in 'processing' state
      const { data: stuckMessages, error: stuckError } = await supabaseClient
        .from('messages')
        .select('id, caption, media_group_id, correlation_id, processing_started_at')
        .eq('processing_state', 'processing')
        .is('analyzed_content', null)
        .order('processing_started_at', { ascending: true })
        .limit(limit);
      
      if (stuckError) {
        throw new Error(`Error finding stuck messages: ${stuckError.message}`);
      }
      
      // Find initialized messages with captions
      const { data: initializedMessages, error: initializedError } = await supabaseClient
        .from('messages')
        .select('id, caption, media_group_id, correlation_id')
        .eq('processing_state', 'initialized')
        .not('caption', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (initializedError) {
        throw new Error(`Error finding initialized messages: ${initializedError.message}`);
      }
      
      // Process stuck messages
      if (stuckMessages && stuckMessages.length > 0) {
        for (const message of stuckMessages) {
          await resetAndProcessMessage(message.id, message.caption, message.media_group_id, correlationId);
          results.stuck_reset++;
        }
      }
      
      // Process initialized messages
      if (initializedMessages && initializedMessages.length > 0) {
        for (const message of initializedMessages) {
          if (message.caption) {
            await processInitializedMessage(message.id, message.caption, message.media_group_id, correlationId);
            results.initialized_processed++;
          }
        }
      }
    }
    
    // 5. Final diagnostic after repairs
    try {
      operations.push('Running post-repair diagnostics');
      const { data: afterStats } = await supabaseClient.rpc('xdelo_get_message_processing_stats');
      if (results.diagnostics) {
        results.diagnostics.after = afterStats;
      } else {
        results.diagnostics = { after: afterStats };
      }
    } catch (diagError) {
      console.warn('Could not get post-repair message processing stats:', diagError);
    }
    
    // 6. Log the complete repair operation
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'processing_system_repair',
        correlation_id: correlationId,
        metadata: {
          operations,
          results,
          triggered_at: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log repair operation:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing system repair completed successfully`,
        correlation_id: correlationId,
        operations,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in repair-processing-flow:', error);
    
    // Log the error
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'processing_system_repair_error',
        error_message: error.message,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log repair error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        error_stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Reset a message to pending state and then process it
 */
async function resetAndProcessMessage(
  messageId: string, 
  caption: string | null, 
  mediaGroupId: string | null,
  correlationId: string
) {
  try {
    // First reset the message to pending state
    const { error: resetError } = await supabaseClient
      .from('messages')
      .update({
        processing_state: 'pending',
        processing_started_at: null,
        error_message: 'Reset from stuck processing state during repair',
        retry_count: supabaseClient.rpc('increment', { row_id: messageId, table: 'messages', column: 'retry_count' }),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (resetError) {
      throw new Error(`Error resetting message ${messageId}: ${resetError.message}`);
    }
    
    // If caption exists, process it directly
    if (caption) {
      await directlyProcessMessage(messageId, caption, mediaGroupId, correlationId);
    }
    
    return true;
  } catch (error) {
    console.error(`Error resetting message ${messageId}:`, error);
    return false;
  }
}

/**
 * Process a message that's already in initialized state
 */
async function processInitializedMessage(
  messageId: string,
  caption: string | null,
  mediaGroupId: string | null,
  correlationId: string
) {
  try {
    // Update to pending state first
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        processing_state: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message ${messageId}: ${updateError.message}`);
    }
    
    if (caption) {
      await directlyProcessMessage(messageId, caption, mediaGroupId, correlationId);
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing initialized message ${messageId}:`, error);
    return false;
  }
}

/**
 * Process a message directly using the manual caption parser
 */
async function directlyProcessMessage(
  messageId: string,
  caption: string,
  mediaGroupId: string | null,
  correlationId: string
) {
  try {
    console.log(`Directly processing message ${messageId}`);
    
    // Use direct-caption-processor for immediate processing
    await supabaseClient.functions.invoke(
      'direct-caption-processor',
      {
        body: { 
          messageId,
          trigger_source: 'repair_operation',
          correlationId
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error(`Error directly processing message ${messageId}:`, error);
    return false;
  }
}

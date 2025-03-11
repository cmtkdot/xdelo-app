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
    const { limit = 10, repair_enums = true, reset_all = false } = await req.json();
    console.log(`Starting to repair processing flow for up to ${limit} messages, reset_all: ${reset_all}`);
    
    // Check if we need to repair enum values first
    if (repair_enums) {
      try {
        // Try to add missing enum values first
        await supabaseClient.rpc('xdelo_ensure_event_types_exist');
        console.log('Enum values checked/repaired');
      } catch (enumError) {
        console.warn('Could not repair enums, proceeding with message repair only:', enumError);
      }
    }
    
    // If reset_all is true, use the function to reset all stuck messages
    if (reset_all) {
      try {
        const { data: resetAllData, error: resetAllError } = await supabaseClient.rpc('xdelo_reset_all_stuck_messages');
        
        if (resetAllError) {
          throw new Error(`Error resetting all stuck messages: ${resetAllError.message}`);
        }
        
        // Also repair orphaned media group messages
        const { data: orphanedData, error: orphanedError } = await supabaseClient.rpc('xdelo_repair_orphaned_media_group_messages');
        
        if (orphanedError) {
          console.warn(`Warning: Could not repair orphaned media group messages: ${orphanedError.message}`);
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Reset all stuck messages and repaired orphaned media group messages',
            data: { 
              processed: resetAllData?.length || 0, 
              orphaned_fixed: orphanedData?.length || 0,
              results: resetAllData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (resetAllError) {
        console.error('Error in batch reset operation:', resetAllError);
        throw resetAllError;
      }
    }
    
    // Otherwise, find messages that are stuck in a 'processing' state
    const { data: stuckMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select('id, caption, media_group_id, correlation_id, processing_started_at')
      .eq('processing_state', 'processing')
      .is('analyzed_content', null)
      .order('processing_started_at', { ascending: true })
      .limit(limit);
    
    if (queryError) {
      throw new Error(`Error finding stuck messages: ${queryError.message}`);
    }
    
    // Also check for initialized messages with captions
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
    
    const allMessagesToReset = [...(stuckMessages || []), ...(initializedMessages || [])];
    
    if (!allMessagesToReset || allMessagesToReset.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No stuck or initialized messages found that need repair',
          data: { processed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${allMessagesToReset.length} messages to repair (${stuckMessages?.length || 0} stuck, ${initializedMessages?.length || 0} initialized)`);
    
    // Process each message
    const results = [];
    for (const message of allMessagesToReset) {
      try {
        // Reset the message to 'pending' state
        const { error: resetError } = await supabaseClient
          .from('messages')
          .update({
            processing_state: 'pending',
            processing_started_at: null,
            error_message: 'Reset from stuck processing state',
            retry_count: supabaseClient.rpc('increment', { row_id: message.id, table: 'messages', column: 'retry_count' }),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (resetError) {
          throw new Error(`Error resetting message: ${resetError.message}`);
        }
        
        // If the message has a caption, process it immediately
        if (message.caption) {
          try {
            // Use direct-caption-processor for immediate processing
            const { error: processingError } = await supabaseClient.functions.invoke(
              'direct-caption-processor',
              {
                body: { 
                  messageId: message.id,
                  trigger_source: 'repair_operation'
                }
              }
            );
            
            if (processingError) {
              console.warn(`Warning: Could not directly process message ${message.id}: ${processingError.message}`);
            }
          } catch (processingError) {
            console.warn(`Processing error (non-fatal) for message ${message.id}: ${processingError.message}`);
          }
        }
        
        // Log the reset - use a try/catch to handle potential enum issues
        try {
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'message_processing_reset',
            entity_id: message.id,
            correlation_id: message.correlation_id || crypto.randomUUID(),
            metadata: {
              reset_reason: 'stuck_in_processing',
              stuck_since: message.processing_started_at,
              has_caption: message.caption ? true : false,
              media_group_id: message.media_group_id
            },
            event_timestamp: new Date().toISOString()
          });
        } catch (logError) {
          console.warn(`Could not log reset operation, continuing: ${logError.message}`);
        }
        
        results.push({
          message_id: message.id,
          status: 'reset_to_pending',
          has_caption: !!message.caption,
          stuck_since: message.processing_started_at
        });
        
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({
          message_id: message.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Attempt to clean up the legacy queue table if it exists
    try {
      await supabaseClient.rpc('xdelo_cleanup_legacy_queue');
      console.log('Legacy queue cleanup attempted');
    } catch (cleanupError) {
      console.warn('Legacy queue cleanup skipped (table might not exist):', cleanupError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset ${results.length} stuck messages to pending state`,
        data: { 
          processed: results.length, 
          stuck_count: stuckMessages?.length || 0,
          initialized_count: initializedMessages?.length || 0,
          results 
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in repair-processing-flow:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

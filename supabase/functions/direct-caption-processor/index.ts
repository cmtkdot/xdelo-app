
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const directCaptionProcessor = async (req: Request, correlationId: string) => {
  // Parse the request body
  const body = await req.json();
  const { messageId, trigger_source = 'database_trigger' } = body;
  
  if (!messageId) {
    throw new Error("Message ID is required");
  }

  console.log(`Direct caption processor triggered for message ${messageId}, correlation ID: ${correlationId}`);
  
  try {
    // Get the message details to check if it has a caption
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id, processing_state, is_original_caption, group_caption_synced')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'Unknown error'}`);
    }
    
    // Skip processing if no caption
    if (!message.caption) {
      // Instead of just skipping, set the message to error state if there's no caption
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: 'No caption to process',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      return new Response(
        JSON.stringify({
          success: false,
          message: `Message ${messageId} failed: No caption to process`,
          correlation_id: correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing caption for message ${messageId}, caption length: ${message.caption.length}`);
    
    // First update the message to processing state
    await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Begin transaction for atomic operations
    const { data: txResult, error: txError } = await supabase.rpc('xdelo_begin_transaction');
    if (txError) {
      console.warn('Transaction begin warning (non-fatal):', txError.message);
    }
    
    // Directly call the manual-caption-parser for simplicity and consistency
    const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
      'manual-caption-parser',
      {
        body: {
          messageId,
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlationId,
          trigger_source
        }
      }
    );
    
    if (analysisError) {
      // Attempt to call parse-caption-with-ai as a fallback
      console.log(`Manual parser failed, trying parse-caption-with-ai as fallback`);
      
      const { data: fallbackResult, error: fallbackError } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: {
            messageId,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId,
            trigger_source: 'direct_fallback'
          }
        }
      );
      
      if (fallbackError) {
        throw new Error(`Analysis failed with both methods: ${analysisError.message}, fallback: ${fallbackError.message}`);
      }
      
      console.log('Fallback caption processing successful');
    } else {
      console.log(`Successfully processed caption for message ${messageId}`);
    }
    
    // Commit transaction to ensure all changes are applied atomically
    const { error: commitError } = await supabase.rpc('xdelo_commit_transaction_with_sync');
    if (commitError) {
      console.warn('Transaction commit warning (non-fatal):', commitError.message);
    }
    
    // For media groups, force sync to ensure all messages get updated
    if (message.media_group_id) {
      try {
        console.log(`Forcing media group sync for group ${message.media_group_id}`);
        
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'xdelo_sync_media_group',
          {
            body: {
              mediaGroupId: message.media_group_id,
              sourceMessageId: messageId,
              correlationId,
              forceSync: true,
              syncEditHistory: true
            }
          }
        );
        
        if (syncError) {
          console.warn(`Media group sync warning (non-fatal): ${syncError.message}`);
        } else {
          console.log(`Media group sync successful: ${JSON.stringify(syncResult)}`);
        }
      } catch (syncError) {
        console.warn(`Media group sync error (non-fatal): ${syncError.message}`);
        
        // Try direct database function as backup
        try {
          const { data: backupSyncResult, error: backupSyncError } = await supabase.rpc(
            'xdelo_sync_media_group_content',
            {
              p_source_message_id: messageId,
              p_media_group_id: message.media_group_id,
              p_correlation_id: correlationId,
              p_force_sync: true
            }
          );
          
          if (backupSyncError) {
            console.warn(`Backup sync also failed: ${backupSyncError.message}`);
          } else {
            console.log(`Backup sync successful: ${JSON.stringify(backupSyncResult)}`);
          }
        } catch (backupError) {
          console.warn(`Backup sync exception: ${backupError.message}`);
        }
      }
    }
    
    // Log the direct processing
    await supabase.from('unified_audit_logs').insert({
      event_type: 'direct_caption_processor_success',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        result: analysisResult?.data || 'No data returned',
        media_group_id: message.media_group_id,
        forced_sync: true
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption processed for message ${messageId}`,
        data: analysisResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error in direct caption processor: ${error.message}`);
    
    // Update the message to error state
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: error.message,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'direct_caption_processor_error',
      entity_id: messageId,
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        error_stack: error.stack
      },
      event_timestamp: new Date().toISOString()
    });
    
    // Try to queue message as a fallback for later processing
    try {
      console.log(`Queueing message ${messageId} for fallback processing`);
      
      await supabase.rpc('xdelo_queue_message_for_processing', {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_priority: 5, // Medium priority
        p_retry_after: 60 // Try again after 60 seconds
      });
      
      console.log(`Message queued for fallback processing`);
    } catch (queueError) {
      console.error(`Failed to queue for fallback: ${queueError.message}`);
    }
    
    throw error;
  }
};

// Wrap the handler with error handling
serve(withErrorHandling('direct-caption-processor', directCaptionProcessor));

import { serve } from "std/http/server.ts"; // Use mapped import
// Import the shared singleton client
import { supabaseClient } from "../_shared/supabase.ts";
import { xdelo_parseCaption } from "../_shared/captionParser.ts";
import { corsHeaders } from "../_shared/cors.ts";
// Import unified handler and helpers
import { createHandler, SecurityLevel, RequestMetadata, createSuccessResponse } from '../_shared/unifiedHandler.ts';
// Import logging utility (assuming it exists or using logProcessingEvent directly)
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

const BATCH_SIZE = 10;
const POLLING_INTERVAL_MS = 10000;
// const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // Keep for potential stalled message logic

// Use the imported shared client
const supabase = supabaseClient;

// --- Main Processing Logic (Polling) ---

async function processPendingMessages() {
  const correlationId = crypto.randomUUID(); // New correlation ID for this batch run
  console.log(`[${correlationId}] Polling for pending messages...`);
  // TODO: Replace console.log with structured logging if a dedicated logger is implemented

  try {
    // 1. Fetch Pending Messages
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id') // Select only needed fields initially
      .eq('processing_state', 'pending')
      .not('caption', 'is', null)
      .not('caption', 'eq', '')
      .order('created_at', { ascending: true }) // Poll oldest first
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error(`[${correlationId}] Error fetching pending messages:`, fetchError);
      await logProcessingEvent('polling_fetch_error', correlationId, correlationId, { error: fetchError.message }, fetchError.message);
      return;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log(`[${correlationId}] No pending messages found.`);
      return;
    }

    console.log(`[${correlationId}] Found ${pendingMessages.length} pending messages. Processing...`);
    await logProcessingEvent('polling_batch_started', correlationId, correlationId, { count: pendingMessages.length });

    // 2. Process Each Message
    for (const message of pendingMessages) {
      const messageId = message.id;
      const messageCorrelationId = `${correlationId}-${messageId.substring(0, 8)}`; // More specific ID per message
      console.log(`[${messageCorrelationId}] Attempting to process message ${messageId}`);

      let lockedMessage: any = null;

      try {
        if (!message.caption || message.caption.trim() === '') {
          console.warn(`[${messageCorrelationId}] Message ${messageId} has empty caption, skipping and setting to error state.`);
          await updateMessageState(messageId, 'error', 'Empty caption despite database filter', undefined, messageCorrelationId);
          await logProcessingEvent('caption_processing_skipped', messageId, messageCorrelationId, { reason: 'Empty caption' }, 'Empty caption');
          continue;
        }

        // 3. Lock Message (Atomic Update)
        const { data: updatedMessage, error: lockError } = await supabase
          .from('messages')
          .update({
            processing_state: 'processing',
            processing_started_at: new Date().toISOString(),
            processing_attempts: supabase.sql`(COALESCE(processing_attempts, 0) + 1)`,
            last_processing_attempt: new Date().toISOString()
          })
          .eq('id', messageId)
          .eq('processing_state', 'pending')
          .select('*') // Select full data after locking
          .single();

        if (lockError || !updatedMessage) {
          console.warn(`[${messageCorrelationId}] Failed to lock message ${messageId} or already processed:`, lockError?.message || 'No message returned');
          // No need to log error here, it's an expected condition (race condition)
          continue;
        }

        lockedMessage = updatedMessage;
        console.log(`[${messageCorrelationId}] Locked message ${messageId} for processing.`);
        await logProcessingEvent('message_lock_acquired', messageId, messageCorrelationId);

        // 4. Parse Caption
        if (!lockedMessage.caption || lockedMessage.caption === '') {
           console.warn(`[${messageCorrelationId}] Message ${messageId} locked but has no caption. Setting to error.`);
           await updateMessageState(messageId, 'error', 'Locked state without caption', undefined, messageCorrelationId);
           await logProcessingEvent('caption_processing_error', messageId, messageCorrelationId, { reason: 'Locked state without caption' }, 'Locked state without caption');
           continue;
         }

         const analyzedContent = xdelo_parseCaption(lockedMessage.caption, {
           messageId,
           correlationId: messageCorrelationId // Pass specific correlation ID
         });
         console.log(`[${messageCorrelationId}] Caption parsed. Partial success: ${!!analyzedContent?.parsing_metadata?.partial_success}`);

        // 5. Update DB (Success)
        await updateMessageState(messageId, 'completed', undefined, analyzedContent, messageCorrelationId);
        console.log(`[${messageCorrelationId}] Message ${messageId} processed successfully.`);
        await logProcessingEvent('caption_processed', messageId, messageCorrelationId, { success: true, partial: !!analyzedContent?.parsing_metadata?.partial_success });

        // 6. Trigger Sync (Conditional)
        if (lockedMessage.media_group_id) {
          console.log(`[${messageCorrelationId}] Message ${messageId} belongs to media group ${lockedMessage.media_group_id}. Triggering sync.`);
          await syncMediaGroup(messageId, lockedMessage.media_group_id, analyzedContent, messageCorrelationId);
        }

      } catch (processingError) {
        console.error(`[${messageCorrelationId}] Error processing message ${messageId}:`, processingError);
        if (messageId) {
            await updateMessageState(messageId, 'error', processingError.message, undefined, messageCorrelationId);
            await logProcessingEvent('caption_processing_failed', messageId, messageCorrelationId, { error: processingError.message }, processingError.message);
        } else {
            // Log general processing error if messageId wasn't available
             await logProcessingEvent('caption_processing_unidentified_error', correlationId, correlationId, { error: processingError.message }, processingError.message);
        }
      }
    } // End loop

    await logProcessingEvent('polling_batch_finished', correlationId, correlationId, { processed_count: pendingMessages.length });

  } catch (batchError) {
    console.error(`[${correlationId}] Error in polling batch:`, batchError);
    await logProcessingEvent('polling_batch_error', correlationId, correlationId, { error: batchError.message }, batchError.message);
  } finally {
    // Schedule the next poll
    console.log(`[${correlationId}] Polling finished. Scheduling next poll in ${POLLING_INTERVAL_MS}ms.`);
    setTimeout(processPendingMessages, POLLING_INTERVAL_MS);
  }
}

// --- Helper Functions ---

async function updateMessageState(messageId: string, state: 'completed' | 'error', errorMessage?: string, analyzedContent?: any, correlationId?: string) {
  const updates: any = {
    processing_state: state,
    updated_at: new Date().toISOString(),
    error_message: errorMessage || null,
  };
  if (state === 'completed') {
    updates.analyzed_content = analyzedContent;
    updates.processing_completed_at = new Date().toISOString();
  }
  if (state === 'error') {
    updates.last_error_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId);

  if (error) {
    console.error(`[${correlationId || 'updateState'}] Failed to update message ${messageId} state to ${state}:`, error);
    // Log this failure
    await logProcessingEvent('message_update_state_failed', messageId, correlationId || crypto.randomUUID(), { target_state: state, error: error.message }, error.message);
  }
}

async function syncMediaGroup(messageId: string, mediaGroupId: string, analyzedContent: any, correlationId: string) {
  try {
    console.log(`[${correlationId}] Calling xdelo_sync_media_group_content for group ${mediaGroupId}`);
    const { error: rpcError, data: rpcData } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_message_id: messageId,
        p_analyzed_content: analyzedContent,
        p_force_sync: true,
        p_sync_edit_history: false
      }
    );

    if (rpcError) {
      console.error(`[${correlationId}] RPC Error syncing media group ${mediaGroupId}:`, rpcError);
      await logProcessingEvent('media_group_sync_failed', messageId, correlationId, { media_group_id: mediaGroupId, error: rpcError.message }, rpcError.message);
    } else {
      console.log(`[${correlationId}] Media group ${mediaGroupId} sync call completed. Result:`, rpcData);
      await logProcessingEvent('media_group_sync_triggered', messageId, correlationId, { media_group_id: mediaGroupId, result: rpcData });
    }
  } catch (syncError) {
    console.error(`[${correlationId}] Exception syncing media group ${mediaGroupId}:`, syncError);
    await logProcessingEvent('media_group_sync_exception', messageId, correlationId, { media_group_id: mediaGroupId, error: syncError.message }, syncError.message);
  }
}

// --- Server & Initial Poll ---

// Start the first poll immediately
console.log("Starting initial poll for direct-caption-processor...");
processPendingMessages();

// --- HTTP Server Part (Refactored with unifiedHandler) ---
const serverHandler = async (req: Request, metadata: RequestMetadata) => {
  // Health check endpoint
  if (metadata.path === '/_health') {
    return createSuccessResponse({ status: 'running', timestamp: new Date().toISOString() }, metadata.correlationId);
  }

  // Manual trigger endpoint
  if (metadata.path === '/trigger-poll' && metadata.method === 'POST') {
    console.log(`[${metadata.correlationId}] Manual poll triggered via HTTP request.`);
    // Run immediately, don't wait for interval. Run async, don't await here.
    processPendingMessages().catch(err => console.error(`[${metadata.correlationId}] Error during manually triggered poll:`, err));
    return createSuccessResponse({ success: true, message: "Manual poll triggered." }, metadata.correlationId);
  }

  // Default response for other paths
  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
};

// Create the handler instance using the builder for the HTTP server part
const handler = createHandler(serverHandler)
  .withMethods(['GET', 'POST', 'OPTIONS']) // Allow GET for health, POST for trigger
  .withSecurity(SecurityLevel.PUBLIC) // Keep endpoints public for now
  .withLogging(true)
  .withMetrics(true);

// Serve the built handler
serve(handler.build());

console.log(`direct-caption-processor edge function started. Polling every ${POLLING_INTERVAL_MS / 1000} seconds. HTTP server running.`);


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep serve for potential health checks or manual triggers
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_parseCaption } from "../_shared/captionParser.ts"; // Import the shared parser - CORRECTED NAME
import { corsHeaders } from "../_shared/cors.ts";
// Assuming a shared logger exists, otherwise implement basic console logging
// import { Logger } from "../_shared/logger.ts";
// Assuming shared DB operations exist for logging, otherwise implement directly
// import { logProcessingEvent } from "../_shared/databaseOperations.ts";

const BATCH_SIZE = 10; // Number of messages to process per poll interval
const POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds (adjust as needed)
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for a message to be considered stalled

// Initialize Supabase client (consider moving to a shared utility)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// --- Main Processing Logic ---

async function processPendingMessages() {
  console.log("Polling for pending messages...");
  const correlationId = crypto.randomUUID(); // New correlation ID for this batch run
  // const logger = new Logger(correlationId, "direct-caption-processor");
  // logger.info("Polling started");

  try {
    // 1. Fetch Pending Messages - ENSURE only messages with non-empty captions are retrieved
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id')
      .eq('processing_state', 'pending')
      .not('caption', 'is', null)
      .not('caption', 'eq', '')
      .order('processing_started_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching pending messages:", fetchError);
      // logger.error("Error fetching pending messages", { error: fetchError.message });
      return; // Exit if fetch fails
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("No pending messages found.");
      // logger.info("No pending messages found.");
      return; // Exit if no messages
    }

    console.log(`Found ${pendingMessages.length} pending messages. Processing...`);
    // logger.info(`Found ${pendingMessages.length} pending messages. Processing...`);

    // 2. Process Each Message in the Batch
    for (const message of pendingMessages) {
      const messageId = message.id;
      // const messageLogger = new Logger(correlationId, `direct-caption-processor:${messageId}`);
      console.log(`Attempting to process message ${messageId}`);
      // messageLogger.info("Attempting to process message");

      let lockedMessage: any = null;

      try {
        // Double-check that caption is not empty before proceeding
        if (!message.caption || message.caption.trim() === '') {
          console.log(`Message ${messageId} has empty caption, skipping and setting to error state.`);
          await updateMessageState(messageId, 'error', 'Empty caption despite database filter');
          continue;
        }

        // 3. Lock Message (Atomic Update)
        // Use RPC to combine fetch and update for atomicity might be better,
        // but a simple update-and-check works for basic locking.
        const { data: updatedMessage, error: lockError } = await supabase
          .from('messages')
          .update({
            processing_state: 'processing',
            processing_started_at: new Date().toISOString(), // Reset start time for this attempt
            processing_attempts: supabase.sql`(COALESCE(processing_attempts, 0) + 1)`,
            last_processing_attempt: new Date().toISOString()
          })
          .eq('id', messageId)
          .eq('processing_state', 'pending') // Ensure it's still pending
          .select('*') // Select the full message data after locking
          .single();

        if (lockError || !updatedMessage) {
          // Could be a conflict (another instance got it) or a genuine error
          console.warn(`Failed to lock message ${messageId} or already processed:`, lockError?.message || 'No message returned');
          // messageLogger.warn("Failed to lock message or already processed", { error: lockError?.message });
          continue; // Skip to the next message
        }

        lockedMessage = updatedMessage; // Store the full message data
        console.log(`Locked message ${messageId} for processing.`);
        // messageLogger.info("Locked message for processing");

        // 4. Parse Caption
        if (!lockedMessage.caption || lockedMessage.caption === '') {
           // This shouldn't happen if the trigger works correctly, but handle defensively
           console.warn(`Message ${messageId} is pending but has no caption. Setting to error.`);
           // messageLogger.warn("Message is pending but has no caption. Setting to error.");
           await updateMessageState(messageId, 'error', 'Pending state without caption');
            continue;
         }

         const analyzedContent = xdelo_parseCaption(lockedMessage.caption, { 
           messageId, 
           correlationId 
         });
         
         // messageLogger.info("Caption parsed", { partial: analyzedContent?.parsing_metadata?.partial_success });

        // 5. Update DB (Success)
        await updateMessageState(messageId, 'completed', undefined, analyzedContent);
        console.log(`Message ${messageId} processed successfully.`);
        // messageLogger.info("Message processed successfully");
        // await logProcessingEvent('caption_processed', messageId, correlationId, { success: true, partial: analyzedContent?.parsing_metadata?.partial_success });

        // 6. Trigger Sync (Conditional)
        if (lockedMessage.media_group_id) {
          console.log(`Message ${messageId} belongs to media group ${lockedMessage.media_group_id}. Triggering sync.`);
          // messageLogger.info("Triggering media group sync");
          await syncMediaGroup(messageId, lockedMessage.media_group_id, analyzedContent, correlationId);
        }

      } catch (processingError) {
        console.error(`Error processing message ${messageId}:`, processingError);
        // messageLogger.error("Error during processing", { error: processingError.message, stack: processingError.stack });
        // 7. Update DB (Error)
        if (messageId) { // Ensure we have messageId even if locking failed somehow before this point
            await updateMessageState(messageId, 'error', processingError.message);
            // await logProcessingEvent('caption_processing_failed', messageId, correlationId, { error: processingError.message });
        }
      }
    } // End loop through messages

  } catch (batchError) {
    console.error("Error in polling batch:", batchError);
    // logger.error("Error in polling batch", { error: batchError.message, stack: batchError.stack });
  } finally {
    // Schedule the next poll regardless of errors in this run
    // logger.info("Polling finished");
    setTimeout(processPendingMessages, POLLING_INTERVAL_MS);
  }
}

// --- Helper Functions ---

async function updateMessageState(messageId: string, state: 'completed' | 'error', errorMessage?: string, analyzedContent?: any) {
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
    console.error(`Failed to update message ${messageId} state to ${state}:`, error);
    // Consider more robust error handling here, maybe retry update?
  }
}

async function syncMediaGroup(messageId: string, mediaGroupId: string, analyzedContent: any, correlationId: string) {
  // const syncLogger = new Logger(correlationId, `direct-caption-processor:${messageId}:sync`);
  try {
    // syncLogger.info(`Calling xdelo_sync_media_group_content for group ${mediaGroupId}`);
    const { error: rpcError, data: rpcData } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_message_id: messageId,
        p_analyzed_content: analyzedContent,
        p_force_sync: true, // Force sync since this is the primary processing path
        p_sync_edit_history: false // Typically don't sync edit history automatically
      }
    );

    if (rpcError) {
      console.error(`RPC Error syncing media group ${mediaGroupId} for message ${messageId}:`, rpcError);
      // syncLogger.error("RPC Error syncing media group", { error: rpcError });
      // Log failure to audit log if needed
      // await logProcessingEvent('media_group_sync_failed', messageId, correlationId, { media_group_id: mediaGroupId, error: rpcError.message });
    } else {
      console.log(`Media group ${mediaGroupId} sync call completed for message ${messageId}. Result:`, rpcData);
      // syncLogger.info("Media group sync call completed", { result: rpcData });
      // await logProcessingEvent('media_group_sync_triggered', messageId, correlationId, { media_group_id: mediaGroupId, result: rpcData });
    }
  } catch (syncError) {
    console.error(`Exception syncing media group ${mediaGroupId} for message ${messageId}:`, syncError);
    // syncLogger.error("Exception syncing media group", { error: syncError });
    // await logProcessingEvent('media_group_sync_exception', messageId, correlationId, { media_group_id: mediaGroupId, error: syncError.message });
  }
}

// --- Server & Initial Poll ---

// Start the first poll immediately
console.log("Starting initial poll...");
processPendingMessages();

// Keep the function alive for subsequent polling via setTimeout
// OR rely on Supabase cron trigger if configured.

// Optional: Basic HTTP server for health checks or manual triggers
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Could add a manual trigger endpoint if needed:
  // if (req.url.includes('/trigger-poll')) {
  //   console.log("Manual poll triggered via HTTP request.");
  //   await processPendingMessages(); // Run immediately, don't wait for interval
  //   return new Response(JSON.stringify({ success: true, message: "Manual poll triggered." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  // }
  return new Response(JSON.stringify({ status: 'running', timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

console.log(`direct-caption-processor edge function started. Polling every ${POLLING_INTERVAL_MS / 1000} seconds.`);

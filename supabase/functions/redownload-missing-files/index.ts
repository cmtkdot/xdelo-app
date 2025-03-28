import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts"; // Use standard logging
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";

interface RedownloadRequestBody {
  messageIds?: string[];
  limit?: number;
  correlationId?: string; // Allow passing correlationId
}

// Core logic for flagging messages for redownload
async function handleRedownloadRequest(req: Request, metadata: RequestMetadata): Promise<Response> {
  const handlerCorrelationId = metadata.correlationId;
  let requestCorrelationId = handlerCorrelationId;

  let requestBody: RedownloadRequestBody;
  try {
    requestBody = await req.json();
    if (requestBody.correlationId) {
      requestCorrelationId = requestBody.correlationId; // Prefer body correlationId if provided
    }
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${requestCorrelationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { messageIds, limit = 10 } = requestBody; // Default limit to 10

  console.log(`[${requestCorrelationId}] Processing redownload request. MessageIDs: ${messageIds?.length ?? 'None'}, Limit: ${limit}`);
  await logProcessingEvent('redownload_request_received', requestCorrelationId, requestCorrelationId, { messageIdsCount: messageIds?.length, limit });

  try {
    // --- Query Messages ---
    let query = supabaseClient
      .from('messages')
      .select('id, redownload_attempts'); // Select only needed fields

    if (messageIds && messageIds.length > 0) {
      console.log(`[${requestCorrelationId}] Querying specific message IDs: ${messageIds.length}`);
      query = query.in('id', messageIds);
    } else {
      console.log(`[${requestCorrelationId}] Querying messages needing redownload (limit ${limit}).`);
      // Find messages flagged or failed previously, prioritizing lower attempts
      query = query
        .eq('needs_redownload', true)
        // .is('redownload_failed', false) // Maybe allow retrying failed ones? Revisit logic if needed.
        .order('redownload_attempts', { ascending: true, nullsFirst: true })
        .order('updated_at', { ascending: true }) // Process older ones first
        .limit(limit);
    }

    const { data: messages, error: queryError } = await query;

    if (queryError) {
      console.error(`[${requestCorrelationId}] Error querying messages:`, queryError);
      await logProcessingEvent('redownload_query_failed', requestCorrelationId, requestCorrelationId, {}, queryError.message);
      throw new Error(`Database query error: ${queryError.message}`);
    }

    if (!messages || messages.length === 0) {
      console.log(`[${requestCorrelationId}] No messages found matching criteria.`);
      await logProcessingEvent('redownload_no_messages_found', requestCorrelationId, requestCorrelationId);
      return createSuccessResponse({
          success: true,
          message: "No messages found needing redownload based on criteria",
          queued: 0
        }, requestCorrelationId);
    }

    console.log(`[${requestCorrelationId}] Found ${messages.length} messages to flag for redownload.`);

    // --- Update Messages to Flag for Redownload ---
    // Add type for message parameter
    const updates = messages.map((message: { id: string; redownload_attempts: number | null }) => ({
      id: message.id,
      needs_redownload: true, // Ensure flag is set
      redownload_failed: false, // Reset failed flag on new attempt
      redownload_attempts: (message.redownload_attempts || 0) + 1,
      redownload_flagged_at: new Date().toISOString(),
      // Storing correlationId here might be redundant if logged elsewhere, but can be useful for tracking
      // correlation_id: requestCorrelationId
    }));

    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates); // Use upsert for safety

    if (updateError) {
      console.error(`[${requestCorrelationId}] Error updating messages to flag redownload:`, updateError);
      await logProcessingEvent('redownload_update_failed', requestCorrelationId, requestCorrelationId, { messageCount: messages.length }, updateError.message);
      throw new Error(`Database update error: ${updateError.message}`);
    }

    console.log(`[${requestCorrelationId}] Successfully flagged ${messages.length} messages for redownload.`);
    await logProcessingEvent('redownload_batch_queued', requestCorrelationId, requestCorrelationId, {
        message_count: messages.length,
        // Add type for m parameter
        message_ids: messages.map((m: { id: string }) => m.id)
    });

    // --- Success Response ---
    return createSuccessResponse({
        success: true,
        message: `Flagged ${messages.length} messages for redownload processing.`,
        queued: messages.length,
      }, requestCorrelationId);

  } catch (error: unknown) {
    // Catch errors thrown from steps above
    const errorMessage = error instanceof Error ? error.message : "Unknown error processing redownload request";
    // Log if not already logged
    if (!errorMessage.includes('error:')) {
        console.error(`[${requestCorrelationId}] Top-level error in redownload request: ${errorMessage}`);
        await logProcessingEvent('redownload_request_failed', requestCorrelationId, requestCorrelationId, {}, errorMessage);
    }
    throw error; // Re-throw for unifiedHandler
  }
}

// Create and configure the handler
const handler = createHandler(handleRedownloadRequest)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.AUTHENTICATED) // Triggering redownloads should require auth
  .build();

// Serve the handler
serve(handler);

console.log("redownload-missing-files function deployed and listening.");

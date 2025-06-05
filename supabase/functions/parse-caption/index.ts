
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve at the bottom
import { xdelo_parseCaption as parseCaption, ParsedContent } from "../_shared/captionParsers.ts";
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { logProcessingEvent } from "../_shared/auditLogger.ts"; 
// Remove syncMediaGroupContent import as we no longer need it
import {
  getMessage,
  logAnalysisEvent,
  updateMessageWithAnalysis,
} from "./dbOperations.ts";

interface ParseCaptionBody {
    messageId: string;
    caption: string;
    media_group_id?: string;
    queue_id?: string; 
    isEdit?: boolean;
    retryCount?: number;
    force_reprocess?: boolean;
    correlationId?: string; 
}

/**
 * Core logic for handling caption parsing request
 */
async function handleParseCaption(req: Request, metadata: RequestMetadata): Promise<Response> {
  // Use correlationId from unifiedHandler, but allow override from body if provided
  const handlerCorrelationId = metadata.correlationId;
  let body: ParseCaptionBody;
  let requestCorrelationId = handlerCorrelationId; // Default to handler's ID

  try {
    body = await req.json();
    // If correlationId is in the body, prefer it for logging continuity
    if (body.correlationId) {
        requestCorrelationId = body.correlationId;
    }
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${requestCorrelationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const {
    messageId,
    caption,
    media_group_id,
    queue_id,
    isEdit = false,
    retryCount = 0,
    force_reprocess = false,
  } = body;

  const captionForLog = caption
    ? caption.length > 50 ? `${caption.substring(0, 50)}...` : caption
    : "(none)";

  console.log(
    `[${requestCorrelationId}] Processing caption for message ${messageId}. isEdit: ${isEdit}, retry: ${retryCount}, force: ${force_reprocess}, caption: ${captionForLog}`
  );
  await logProcessingEvent('caption_parse_started', messageId, requestCorrelationId, { isEdit, retryCount, force_reprocess, captionLength: caption?.length ?? 0 });

  if (!messageId || !caption) {
    console.error(`[${requestCorrelationId}] Missing required parameters: messageId and caption`);
    await logProcessingEvent('caption_parse_failed', messageId || 'unknown', requestCorrelationId, { reason: 'Missing parameters' }, 'Missing messageId or caption');
    throw new Error("Invalid request: messageId and caption are required.");
  }

  try {
    // --- Fetch Existing Message ---
    const fetchStart = Date.now();
    const message = await getMessage(messageId); 
    console.log(`[${requestCorrelationId}] Fetched message ${messageId} in ${Date.now() - fetchStart}ms`);

    // --- Check if Reprocessing Needed ---
    if (message?.analyzed_content && !isEdit && !force_reprocess) {
      console.log(`[${requestCorrelationId}] Message ${messageId} already analyzed. Skipping.`);
      await logProcessingEvent('caption_parse_skipped', messageId, requestCorrelationId, { reason: 'Already analyzed' });
      // Return success, but indicate it was skipped
      return createSuccessResponse({
          success: true,
          skipped: true,
          message: `Message already has analyzed content`,
          data: message.analyzed_content,
        }, requestCorrelationId);
    }

    // --- Parse Caption ---
    const parseStart = Date.now();
    console.log(`[${requestCorrelationId}] Performing manual parsing on caption: ${captionForLog}`);
    let parsedContent: ParsedContent = parseCaption(caption, { messageId, correlationId: requestCorrelationId });
    console.log(`[${requestCorrelationId}] Caption parsed in ${Date.now() - parseStart}ms. Partial: ${!!parsedContent?.parsing_metadata?.partial_success}`);

    // --- Enrich Parsing Metadata ---
    parsedContent.caption = caption; // Ensure original caption is stored if needed
    if (media_group_id) parsedContent.sync_metadata = { media_group_id };
    if (isEdit) {
        parsedContent.parsing_metadata.is_edit = true;
        parsedContent.parsing_metadata.edit_timestamp = new Date().toISOString();
    }
    if (force_reprocess) {
        parsedContent.parsing_metadata.force_reprocess = true;
        parsedContent.parsing_metadata.reprocess_timestamp = new Date().toISOString();
    }
    if (retryCount > 0) {
        parsedContent.parsing_metadata.retry_count = retryCount;
        parsedContent.parsing_metadata.retry_timestamp = new Date().toISOString();
    }

    // --- Log Analysis Event ---
    await logAnalysisEvent(
      messageId,
      requestCorrelationId,
      { analyzed_content: message?.analyzed_content }, // Previous state
      { analyzed_content: parsedContent }, // New state
      { /* Additional metadata */ }
    );

    // --- Update Message in DB ---
    console.log(`[${requestCorrelationId}] Updating message ${messageId} with analyzed content.`);
    const updateResult = await updateMessageWithAnalysis(
      messageId,
      parsedContent,
      message, // Pass fetched message for context
      queue_id,
      isEdit || force_reprocess
    );
    console.log(`[${requestCorrelationId}] Update result: ${JSON.stringify(updateResult)}`);
    await logProcessingEvent('caption_parse_db_updated', messageId, requestCorrelationId, { updateResult });

    // --- Media Group Sync Handling ---
    // We've removed the explicit media group sync code here 
    // The database trigger will now handle this automatically
    // Just log that we're relying on the trigger
    if (media_group_id) {
      console.log(`[${requestCorrelationId}] Media group ${media_group_id} sync will be handled by database trigger`);
      await logProcessingEvent('media_group_sync_delegated_to_trigger', messageId, requestCorrelationId, { media_group_id });
    }

    // --- Success Response ---
    console.log(`[${requestCorrelationId}] Caption processing successful for message ${messageId}.`);
    return createSuccessResponse({
        success: true,
        message: "Caption parsed successfully",
        message_id: messageId,
        parsed_content: parsedContent,
        // No sync_result field needed anymore
      }, requestCorrelationId);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during caption parsing";
    console.error(`[${requestCorrelationId}] Error processing caption for message ${messageId}: ${errorMessage}`, error);

    // Log the error using the standard mechanism
    await logProcessingEvent('caption_parse_failed', messageId || 'unknown', requestCorrelationId, { isEdit, retryCount, force_reprocess }, errorMessage);

    // Throw the original error to be handled by unifiedHandler
    throw new Error(errorMessage);
  }
}

// Create and configure the handler
const handler = createHandler(handleParseCaption)
  .withMethods(['POST']) // Parsing is triggered via POST
  .withSecurity(SecurityLevel.AUTHENTICATED) // Assume internal service or authenticated user triggers parsing
  .build();

// Serve the handler
serve(handler);

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/auditLogger.ts"; // Import from dedicated module
import { findBestProductMatch } from './matching-utils.ts';
import { ProductMatchRequest, ProductMatchResponse, GlProduct } from './types.ts';

console.log('Product matching function started');

// Define payload interfaces
interface WebhookPayload {
  type?: string;
  request?: ProductMatchRequest;
  messageIds?: string[];
  batch?: boolean;
  customText?: string;
  config?: Record<string, any>;
}

// Default configuration (Consider moving to a shared config or env vars)
const DEFAULT_CONFIG = {
  similarityThreshold: 0.7,
  minConfidence: 0.6,
  weights: { productName: 0.4, vendorUid: 0.3, purchaseDate: 0.3 },
  partialMatch: { enabled: true },
  algorithm: { useJaroWinkler: true }
};

// Core handler logic
async function handleProductMatching(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing product-matching request`);

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const config = { ...DEFAULT_CONFIG, ...(payload.config || {}) }; // Merge default and request config

  await logProcessingEvent('product_matching_started', correlationId, correlationId, {
      type: payload.messageIds ? 'bulk' : (payload.request ? 'single_message' : (payload.customText ? 'single_text' : 'unknown')),
      messageIdsCount: payload.messageIds?.length,
      hasRequest: !!payload.request,
      hasCustomText: !!payload.customText,
      configUsed: config // Log the effective config
  });

  try {
    let resultData: any;
    if (payload.messageIds && Array.isArray(payload.messageIds)) {
      // Bulk request
      console.log(`[${correlationId}] Routing to bulk match processing.`);
      resultData = await processBulkMatch(correlationId, payload.messageIds, config);
    } else if (payload.request || payload.customText) {
      // Single request
      console.log(`[${correlationId}] Routing to single match processing.`);
      const singleRequest = payload.request ?? { customText: payload.customText };
      resultData = await processProductMatch(correlationId, singleRequest, config);
    } else {
      await logProcessingEvent('product_matching_failed', correlationId, correlationId, { reason: 'Invalid format' }, 'Invalid request format');
      throw new Error('Invalid request format. Expected "messageIds" array or "request"/"customText" object.');
    }

    await logProcessingEvent('product_matching_completed', correlationId, correlationId, { summary: resultData?.summary || 'OK' });
    return createSuccessResponse({ success: true, ...resultData }, correlationId);

  } catch (error: unknown) {
    // Catch errors thrown by processing functions
    const errorMessage = error instanceof Error ? error.message : "Unknown error during product matching";
    console.error(`[${correlationId}] Error during product matching: ${errorMessage}`);
    // Log if not already logged (might be redundant if processing functions log before throwing)
    await logProcessingEvent('product_matching_failed', correlationId, correlationId, {}, errorMessage);
    throw error; // Re-throw for unifiedHandler
  }
}

// --- Processing Functions (Refactored) ---

// Modified signature to accept either messageId or customText
async function processProductMatch(
  correlationId: string,
  request: { messageId?: string; customText?: string; minConfidence?: number },
  config: Record<string, any>
): Promise<{ matches: Array<any>; bestMatch: any | null }> { // Return data directly
  const logEntityId = request.messageId || correlationId; // Use messageId if available for entity log
  const minConfidence = request.minConfidence ?? config.minConfidence ?? 0.6;

  try {
    // Fetch products (common step)
    const { data: products, error: queryError } = await supabaseClient
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false }) // Consider if ordering/limiting is always needed
      .limit(100); // Consider if limit is appropriate

    if (queryError) {
      throw new Error(`Failed to fetch products: ${queryError.message}`);
    }
    if (!products) {
        throw new Error('No products found for matching.');
    }
    await logProcessingEvent('product_fetch_success', logEntityId, correlationId, { productCount: products.length });

    let productName = '';
    let vendorUid = '';
    let purchaseDate = '';

    // Determine input source: customText or messageId
    if (request.customText) {
      console.log(`[${correlationId}] Matching custom text against ${products.length} products.`);
      productName = request.customText; // Use custom text as the primary name for matching
      // vendorUid and purchaseDate remain empty for custom text matching unless more analysis is added
      await logProcessingEvent('custom_text_matching', logEntityId, correlationId, { textLength: productName.length });

    } else if (request.messageId) {
      const messageId = request.messageId; // Assign to local variable for clarity
      console.log(`[${correlationId}] Fetching message ${messageId} for matching.`);
      const { data: message, error: messageError } = await supabaseClient
        .from('messages')
        .select('id, caption, analyzed_content') // Select necessary fields
        .eq('id', messageId) // Use local variable
        .single();

      if (messageError) throw new Error(`Failed to fetch message: ${messageError.message}`);
      if (!message) throw new Error(`Message not found with ID: ${messageId}`); // Use local variable

      await logProcessingEvent('message_fetch_success', messageId, correlationId); // Use messageId for entity

      const analyzedContent = message.analyzed_content || {};
      productName = analyzedContent.product_name || message.caption || '';
      vendorUid = analyzedContent.vendor_uid || '';
      purchaseDate = analyzedContent.purchase_date || '';
      console.log(`[${correlationId}] Matching message ${messageId} (Name: ${productName.substring(0,30)}...) against ${products.length} products.`);

    } else {
      // This case should ideally not be reached due to checks in handleProductMatching
      throw new Error('Internal error: No messageId or customText provided to processProductMatch');
    }

    // Find matches using the utility function
    const { matches, bestMatch } = findBestProductMatch(
      products as GlProduct[],
      productName,
      '', // vendorName - not used currently
      '', // poNumber - not used currently
      vendorUid,
      purchaseDate,
      minConfidence
    );

    await logProcessingEvent('match_finding_completed', logEntityId, correlationId, { matchCount: matches.length, bestMatchFound: !!bestMatch });
    console.log(`[${correlationId}] Found ${matches.length} potential matches. Best match: ${bestMatch ? bestMatch.product_id : 'None'}`);

    // Return structured data
    return { matches, bestMatch };

  } catch (error: unknown) {
    // Log error and re-throw
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during single product match';
    console.error(`[${correlationId}] Error in processProductMatch for ${logEntityId}:`, errorMessage);
    // Log specific error before throwing
    await logProcessingEvent('single_match_failed', logEntityId, correlationId, {}, errorMessage);
    throw new Error(errorMessage); // Let main handler catch
  }
}

async function processBulkMatch(
  correlationId: string,
  message_ids: string[],
  config: Record<string, any>
): Promise<{ results: any[]; summary: { total: number; matched: number; unmatched: number; failed: number } }> { // Return data directly
  const action = 'bulk_match';
  const minConfidence = config.minConfidence ?? 0.6;
  const approvalThreshold = config.approvalThreshold ?? 0.75; // Threshold to auto-approve and update message

  console.log(`[${correlationId}] Processing ${action} for ${message_ids.length} messages`);
  await logProcessingEvent('bulk_match_started', correlationId, correlationId, { count: message_ids.length });

  try {
    // Fetch messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('id, caption, analyzed_content')
      .in('id', message_ids);

    if (messagesError) throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    if (!messages) throw new Error('No messages found for the provided IDs.');
    await logProcessingEvent('bulk_messages_fetched', correlationId, correlationId, { fetchedCount: messages.length });

    // Fetch products
    const { data: products, error: productsError } = await supabaseClient
      .from('gl_products')
      .select('*') // Select necessary fields for matching
      .order('created_at', { ascending: false }) // Consider if ordering/limit needed
      .limit(100); // Adjust limit as needed

    if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`);
    if (!products) throw new Error('No products found for matching.');
    await logProcessingEvent('bulk_products_fetched', correlationId, correlationId, { productCount: products.length });

    const matchResults = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let failedCount = 0;

    for (const message of messages) {
      const messageLogId = message.id;
      try {
        const analyzedContent = message.analyzed_content || {};
        const productName = analyzedContent.product_name || message.caption || '';
        const vendorUid = analyzedContent.vendor_uid || '';
        const purchaseDate = analyzedContent.purchase_date || '';

        const { matches, bestMatch } = findBestProductMatch(
          products as GlProduct[], productName, '', '', vendorUid, purchaseDate, minConfidence
        );

        let matchRecorded = false;
        let dbErrorMsg: string | null = null;

        if (bestMatch && bestMatch.confidence_score >= minConfidence) {
          try {
            const matchStatus = bestMatch.confidence_score >= approvalThreshold ? 'approved' : 'pending';
            const { error: matchError } = await supabaseClient
              .from('sync_matches')
              .upsert({ // Use upsert to handle potential re-runs
                message_id: message.id,
                product_id: bestMatch.product_id,
                confidence: bestMatch.confidence_score,
                // Explicitly type 'k' as keyof typeof bestMatch.match_criteria if possible, or string
                match_fields: bestMatch.match_criteria ? Object.keys(bestMatch.match_criteria).filter((k: string) => bestMatch.match_criteria[k as keyof typeof bestMatch.match_criteria]) : [],
                status: matchStatus,
                // created_at handled by default value?
                updated_at: new Date().toISOString()
              }, { onConflict: 'message_id' }); // Upsert based on message_id

            if (matchError) throw new Error(`Match recording error: ${matchError.message}`);
            matchRecorded = true;

            // Update message if approved
            if (matchStatus === 'approved') {
              const { error: updateMsgError } = await supabaseClient
                .from('messages')
                .update({ glide_row_id: bestMatch.product_id, updated_at: new Date().toISOString() })
                .eq('id', message.id);
              if (updateMsgError) throw new Error(`Message update error: ${updateMsgError.message}`);
            }
            matchedCount++;
            await logProcessingEvent('bulk_message_matched', messageLogId, correlationId, { productId: bestMatch.product_id, confidence: bestMatch.confidence_score, status: matchStatus });

          } catch (dbError: unknown) {
             dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
             console.error(`[${correlationId}] Database error for message ${messageLogId}:`, dbErrorMsg);
             failedCount++;
             await logProcessingEvent('bulk_match_db_error', messageLogId, correlationId, {}, dbErrorMsg);
          }
        } else {
          unmatchedCount++;
          await logProcessingEvent('bulk_message_unmatched', messageLogId, correlationId, { reason: 'No match above threshold' });
        }

        matchResults.push({
          messageId: message.id,
          success: !dbErrorMsg, // Success if no DB error occurred during recording/update
          matched: matchRecorded,
          bestMatch: bestMatch ? {
            product_id: bestMatch.product_id,
            confidence_score: bestMatch.confidence_score,
            // Optionally add product name back if needed for response
            // product_name: (products.find(p => p.id === bestMatch.product_id) || {}).new_product_name || 'Unknown'
          } : null,
          error: dbErrorMsg
        });

      } catch (messageError: unknown) {
        const errorMessage = messageError instanceof Error ? messageError.message : String(messageError);
        console.error(`[${correlationId}] Error processing message ${messageLogId} in bulk:`, errorMessage);
        matchResults.push({ messageId: message.id, success: false, error: errorMessage });
        failedCount++;
        await logProcessingEvent('bulk_message_failed', messageLogId, correlationId, {}, errorMessage);
      }
    } // end for loop

    const summary = { total: messages.length, matched: matchedCount, unmatched: unmatchedCount, failed: failedCount };
    console.log(`[${correlationId}] Bulk matching finished. Summary:`, summary);
    await logProcessingEvent('bulk_match_finished', correlationId, correlationId, { summary });

    return { results: matchResults, summary };

  } catch (error: unknown) {
    // Log error and re-throw
    const errorMessage = error instanceof Error ? error.message : `Unknown error in ${action}`;
    console.error(`[${correlationId}] Error in ${action}:`, errorMessage);
    await logProcessingEvent('bulk_match_error', correlationId, correlationId, {}, errorMessage);
    throw new Error(errorMessage); // Let main handler catch
  }
}


// --- Server Setup ---

// Create and configure the handler
const handler = createHandler(handleProductMatching)
  .withMethods(['POST']) // Matching actions are triggered via POST
  .withSecurity(SecurityLevel.AUTHENTICATED) // Assume matching requires auth
  .build();

// Serve the handler
serve(handler);

console.log("product-matching function deployed and listening.");

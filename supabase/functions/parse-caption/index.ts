import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  logErrorToDatabase,
  updateMessageWithError,
  withErrorHandling,
} from "../_shared/errorHandler.ts";
import {
  getMessage,
  logAnalysisEvent,
  markQueueItemAsFailed,
  syncMediaGroupContent,
  updateMessageWithAnalysis,
} from "./dbOperations.ts";
import { ParsedContent } from "./types.ts";

// Define corsHeaders here since we deleted the import
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Max-Age": "86400", // 24 hours caching for preflight requests
};

// Define a simple version of xdelo_parseCaption since we deleted the import
function xdelo_parseCaption(
  caption: string | null | undefined,
  options: {
    extractPurchaseDate?: boolean;
    extractProductCode?: boolean;
    extractVendorUid?: boolean;
    extractPricing?: boolean;
  } = {}
): ParsedContent {
  // Simple implementation of the parser
  if (!caption) {
    return {
      parsing_metadata: {},
    };
  }

  const lines = caption
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result: ParsedContent = {
    caption,
    raw_lines: lines,
    raw_text: caption,
    parsing_metadata: {},
  };

  if (lines.length > 0) {
    result.product_name = lines[0];
  }

  return result;
}

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const handleCaptionAnalysis = async (req: Request, correlationId: string) => {
  const body = await req.json();

  const {
    messageId,
    caption,
    media_group_id,
    queue_id,
    isEdit = false,
    retryCount = 0,
    force_reprocess = false,
  } = body;

  const requestCorrelationId = body.correlationId || correlationId;

  const captionForLog = caption
    ? caption.length > 50
      ? `${caption.substring(0, 50)}...`
      : caption
    : "(none)";

  console.log(
    `Processing caption for message ${messageId}, correlation_id: ${requestCorrelationId}, isEdit: ${isEdit}, retry: ${retryCount}, force_reprocess: ${force_reprocess}, caption: ${captionForLog}`
  );

  if (!messageId || !caption) {
    throw new Error(
      "Required parameters missing: messageId and caption are required"
    );
  }

  try {
    console.log(`Fetching current state for message ${messageId}`);
    const existingMessage = await getMessage(messageId);

    // If message has analyzed content, and we're not editing or force reprocessing, skip
    if (existingMessage?.analyzed_content && !isEdit && !force_reprocess) {
      console.log(
        `Message ${messageId} already has analyzed content and force_reprocess is not enabled, skipping`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: `Message already has analyzed content`,
          data: existingMessage.analyzed_content,
          correlation_id: requestCorrelationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Current message state: ${JSON.stringify({
        id: existingMessage?.id,
        processing_state: existingMessage?.processing_state,
        has_analyzed_content: !!existingMessage?.analyzed_content,
        media_group_id: existingMessage?.media_group_id,
        force_reprocess: force_reprocess,
      })}`
    );

    console.log(`Performing manual parsing on caption: ${captionForLog}`);
    // Use the shared parser function
    let parsedContent: ParsedContent = xdelo_parseCaption(caption);
    console.log(`Manual parsing result: ${JSON.stringify(parsedContent)}`);

    parsedContent.caption = caption;

    if (media_group_id) {
      parsedContent.sync_metadata = {
        media_group_id: media_group_id,
      };
    }

    if (isEdit) {
      console.log(`Message ${messageId} is being processed as an edit`);
      parsedContent.parsing_metadata.is_edit = true;
      parsedContent.parsing_metadata.edit_timestamp = new Date().toISOString();
    }

    if (force_reprocess) {
      console.log(`Message ${messageId} is being force reprocessed`);
      parsedContent.parsing_metadata.force_reprocess = true;
      parsedContent.parsing_metadata.reprocess_timestamp =
        new Date().toISOString();
    }

    if (retryCount > 0) {
      parsedContent.parsing_metadata.retry_count = retryCount;
      parsedContent.parsing_metadata.retry_timestamp = new Date().toISOString();
    }

    console.log(`Logging analysis event for message ${messageId}`);
    await logAnalysisEvent(
      messageId,
      requestCorrelationId,
      { analyzed_content: existingMessage?.analyzed_content },
      { analyzed_content: parsedContent },
      {
        source: "parse-caption",
        caption: captionForLog,
        media_group_id: media_group_id,
        method: "manual",
        is_edit: isEdit,
        force_reprocess: force_reprocess,
        retry_count: retryCount,
      }
    );

    console.log(
      `Updating message ${messageId} with analyzed content, isEdit: ${isEdit}, force_reprocess: ${force_reprocess}`
    );
    const updateResult = await updateMessageWithAnalysis(
      messageId,
      parsedContent,
      existingMessage,
      queue_id,
      isEdit || force_reprocess
    );
    console.log(`Update result: ${JSON.stringify(updateResult)}`);

    let syncResult = null;
    if (media_group_id) {
      try {
        console.log(
          `Starting media group content sync for group ${media_group_id}, message ${messageId}, isEdit: ${isEdit}, force_reprocess: ${force_reprocess}`
        );

        const syncResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/xdelo_sync_media_group`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get(
                "SUPABASE_SERVICE_ROLE_KEY"
              )}`,
            },
            body: JSON.stringify({
              mediaGroupId: media_group_id,
              sourceMessageId: messageId,
              correlationId: requestCorrelationId,
              forceSync: true,
              syncEditHistory: isEdit || force_reprocess,
            }),
          }
        );

        if (syncResponse.ok) {
          syncResult = await syncResponse.json();
          console.log(
            `Media group sync result from edge function: ${JSON.stringify(
              syncResult
            )}`
          );
        } else {
          console.warn(
            `Edge function sync failed with ${syncResponse.status}, trying direct sync`
          );
          syncResult = await syncMediaGroupContent(
            media_group_id,
            messageId,
            requestCorrelationId,
            isEdit || force_reprocess
          );
          console.log(
            `Media group sync result from direct function: ${JSON.stringify(
              syncResult
            )}`
          );
        }
      } catch (syncError) {
        console.error(
          `Media group sync error (non-fatal): ${syncError.message}`
        );
        await logErrorToDatabase(supabaseClient, {
          messageId,
          errorMessage: `Media group sync error: ${syncError.message}`,
          correlationId: requestCorrelationId,
          functionName: "parse-caption",
        });
      }
    } else {
      console.log(`No media_group_id provided, skipping group sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption analyzed successfully for message ${messageId}`,
        data: parsedContent,
        sync_result: syncResult,
        correlation_id: requestCorrelationId,
        is_edit: isEdit,
        force_reprocess: force_reprocess,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error analyzing caption: ${error.message}`);

    await logErrorToDatabase(supabaseClient, {
      messageId,
      errorMessage: error.message,
      correlationId: requestCorrelationId,
      functionName: "parse-caption",
    });

    await updateMessageWithError(
      supabaseClient,
      messageId,
      error.message,
      requestCorrelationId
    );

    if (queue_id) {
      await markQueueItemAsFailed(queue_id, error.message);
    }

    throw error;
  }
};
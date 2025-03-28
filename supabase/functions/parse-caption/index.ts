
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ParsedContent, xdelo_parseCaption as parseCaption } from "../_shared/captionParsers.ts";
import { MediaGroupResult } from "./types.ts";
import {
  logErrorToDatabase,
  updateMessageWithError,
} from "../_shared/errorHandler.ts";
import {
  getMessage,
  logAnalysisEvent,
  updateMessageWithAnalysis,
} from "./dbOperations.ts";
import { syncMediaGroupContent } from "../_shared/mediaGroupSync.ts";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

/**
 * Handle caption parsing request
 */
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
    const startTime = Date.now();
    console.log(JSON.stringify({
      event: "fetch_message_start",
      messageId,
      correlationId: requestCorrelationId,
      timestamp: new Date().toISOString()
    }));

    const message = await getMessage(messageId);

    console.log(JSON.stringify({
      event: "fetch_message_complete",
      messageId,
      correlationId: requestCorrelationId,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    if (message?.analyzed_content && !isEdit && !force_reprocess) {
      console.log(
        `Message ${messageId} already has analyzed content and force_reprocess is not enabled, skipping`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: `Message already has analyzed content`,
          data: message.analyzed_content,
          correlation_id: requestCorrelationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Current message state: ${JSON.stringify({
        id: message?.id,
        processing_state: message?.processing_state,
        has_analyzed_content: !!message?.analyzed_content,
        media_group_id: message?.media_group_id,
        force_reprocess: force_reprocess,
      })}`
    );

    const parseStart = Date.now();
    console.log(`Performing manual parsing on caption: ${captionForLog}`);
    let parsedContent: ParsedContent = parseCaption(caption, {
      messageId,
      correlationId: requestCorrelationId
    });
    console.log(JSON.stringify({
      event: "parse_complete",
      messageId,
      correlationId: requestCorrelationId,
      durationMs: Date.now() - parseStart,
      timestamp: new Date().toISOString()
    }));
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
      { analyzed_content: message?.analyzed_content },
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
      message,
      queue_id,
      isEdit || force_reprocess
    );
    console.log(`Update result: ${JSON.stringify(updateResult)}`);

    let syncResult: MediaGroupResult | null = null;
    if (media_group_id) {
      try {
        console.log(
          `Starting media group content sync for group ${media_group_id}, message ${messageId}, isEdit: ${isEdit}, force_reprocess: ${force_reprocess}`
        );

        // Use our shared utility for media group sync with the correct parameters
        syncResult = await syncMediaGroupContent(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          messageId,
          parsedContent,
          {
            forceSync: true,
            syncEditHistory: isEdit
          }
        );

        console.log(`Media group sync completed with result: ${JSON.stringify(syncResult)}`);
      } catch (syncError) {
        console.error(
          `Media group sync error (non-fatal): ${syncError.message}`
        );
    await logErrorToDatabase({
      messageId,
      errorMessage: `Media group sync error: ${syncError.message}`,
      correlationId: requestCorrelationId,
      functionName: "parse-caption",
    });
      }
    }

    let forward_info: {
      from_user: any;
      from_chat: any;
      from_message_id: any;
      signature: any;
      sender_name: any;
      date: string | null;
      origin: any;
    } | null = null;
    if (message.forward_from) {
      forward_info = {
        from_user: message.forward_from,
        from_chat: message.forward_from_chat,
        from_message_id: message.forward_from_message_id,
        signature: message.forward_signature,
        sender_name: message.forward_sender_name,
        date: message.forward_date
          ? new Date(message.forward_date * 1000).toISOString()
          : null,
        origin: message.forward_origin,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption parsed successfully",
        message_id: messageId,
        media_group_id: media_group_id,
        correlation_id: requestCorrelationId,
        is_edit: isEdit,
        force_reprocess: force_reprocess,
        parsed_content: parsedContent,
        sync_result: syncResult,
        forward_info: forward_info,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error processing caption: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    await updateMessageWithError(
      messageId,
      error.message
    );

    await logErrorToDatabase({
      messageId,
      errorMessage: error.message,
      correlationId: requestCorrelationId,
      functionName: "parse-caption",
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: "Error parsing caption",
        error: error.message,
        message_id: messageId,
        correlation_id: requestCorrelationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};


// Serve HTTP requests
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const correlationId = crypto.randomUUID();

  try {
    if (req.method === "POST") {
      return await handleCaptionAnalysis(req, correlationId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      }
    );
  } catch (error) {
    console.error(`Unhandled error: ${error.message}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

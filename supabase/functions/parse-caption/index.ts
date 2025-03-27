import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ParsedContent, xdelo_parseCaption } from "../_shared/captionParser.ts";
import {
  logErrorToDatabase,
  updateMessageWithError,
} from "../_shared/errorHandler.ts";
import {
  getMessage,
  logAnalysisEvent,
  updateMessageWithAnalysis,
} from "./dbOperations.ts";

// Define corsHeaders for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Max-Age": "86400", // 24 hours caching for preflight requests
};

// Create Supabase client
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
    console.log(`Fetching current state for message ${messageId}`);
    const message = await getMessage(messageId);

    // If message has analyzed content, and we're not editing or force reprocessing, skip
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

    console.log(`Performing manual parsing on caption: ${captionForLog}`);
    // Use the shared parser function from _shared/captionParser.ts
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

    let syncResult = null;
    if (media_group_id) {
      try {
        console.log(
          `Starting media group content sync for group ${media_group_id}, message ${messageId}, isEdit: ${isEdit}, force_reprocess: ${force_reprocess}`
        );
{
  "event_message": "{\n  \"summary\": \"🔴 [ERROR] [telegram-webhook] ❌ Error processing non-media message:\",\n  \"level\": \"ERROR\",\n  \"correlation_id\": \"75102c74-3996-4b32-8fa4-3d1c6b8036d6\",\n  \"component\": \"telegram-webhook\",\n  \"message\": \"❌ Error processing non-media message:\",\n  \"timestamp\": \"2025-03-27T02:09:10.857Z\",\n  \"error\": \"Could not find the 'message_type' column of 'messages' in the schema cache\",\n  \"stack\": \"Error: Could not find the 'message_type' column of 'messages' in the schema cache\\n    at handleOtherMessage (file:///Users/lamjo/xdelo-app-2/supabase/functions/telegram-webhook/handlers/textMessageHandler.ts:35:13)\\n    at eventLoopTick (ext:core/01_core.js:168:7)\\n    at async Server.<anonymous> (file:///Users/lamjo/xdelo-app-2/supabase/functions/telegram-webhook/index.ts:117:20)\\n    at async #respond (https://deno.land/std@0.208.0/http/server.ts:224:18)\",\n  \"message_id\": 6248\n}\n",
  "id": "b7f53dbe-69f3-495a-8f21-c4af777dafaa",
  "metadata": [
    {
      "boot_time": null,
      "cpu_time_used": null,
      "deployment_id": "xjhhehxcxkiumnwbirel_fd6019e1-94c7-4952-9f79-d7bf86e23159_60",
      "event_type": "Log",
      "execution_id": "e57b0199-3c94-4619-8185-f672eb959a24",
      "function_id": "fd6019e1-94c7-4952-9f79-d7bf86e23159",
      "level": "log",
      "memory_used": [],
      "project_ref": "xjhhehxcxkiumnwbirel",
      "reason": null,
      "region": "eu-central-1",
      "served_by": "supabase-edge-runtime-1.67.3 (compatible with Deno v1.45.2)",
      "timestamp": "2025-03-27T02:09:10.857Z",
      "version": "60"
    }
  ],
  "timestamp": 1743041351425835
}${JSON.stringify(syncResult)}`);
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error processing caption: ${error.message}`);

    // Update message to error state
    await updateMessageWithError(supabaseClient, messageId, error.message);

    // Log the error
    await logErrorToDatabase(supabaseClient, {
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

/**
 * Get a message by ID
 */
async function getMessage(messageId: string) {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (error) {
    throw new Error(`Error fetching message: ${error.message}`);
  }

  return data;
}

/**
 * Update a message with analyzed content
 */
async function updateMessageWithAnalysis(
  messageId: string,
  parsedContent: any,
  existingMessage: any,
  queueId?: string,
  isEdit: boolean = false
) {
  const updateData: any = {
    analyzed_content: parsedContent,
    processing_state: "completed",
    processing_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingMessage?.media_group_id) {
    updateData.is_original_caption = true;
  }

  if (isEdit && existingMessage?.analyzed_content) {
    // Store the previous content as old_analyzed_content to preserve history
    updateData.old_analyzed_content = existingMessage.analyzed_content;
  }

  const { data, error } = await supabaseClient
    .from("messages")
    .update(updateData)
    .eq("id", messageId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating message: ${error.message}`);
  }

  // If there's a queue item to update, do it
  if (queueId) {
    try {
      await supabaseClient
        .from("message_processing_queue")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          result: parsedContent,
        })
        .eq("id", queueId);
    } catch (queueError) {
      console.error(`Error updating queue item: ${queueError.message}`);
      // Non-fatal, continue processing
    }
  }

  return data;
}

/**
 * Log an analysis event
 */
async function logAnalysisEvent(
  messageId: string,
  correlationId: string,
  oldState: any,
  newState: any,
  metadata: any
) {
  try {
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: "caption_analyzed",
      entity_id: messageId,
      correlation_id: correlationId,
      previous_state: oldState,
      new_state: newState,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`Error logging analysis event: ${error.message}`);
    // Non-fatal, continue processing
  }
}

// Serve HTTP requests
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  // Generate a correlation ID for tracking
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

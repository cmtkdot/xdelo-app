
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "./cors.ts";

export type ProcessingStatus = {
  success: boolean;
  message: string;
  processed_count: number;
  failed_count: number;
  details: any[];
};

/**
 * Forces processing of pending messages
 * This can be used to manually trigger processing of messages that are stuck
 */
export async function forcePendingMessagesProcessing(
  supabaseUrl: string,
  supabaseKey: string,
  options: {
    limit?: number;
    specificIds?: string[];
    detailedLogs?: boolean;
  } = {}
): Promise<ProcessingStatus> {
  const { limit = 10, specificIds, detailedLogs = false } = options;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const response: ProcessingStatus = {
    success: true,
    message: "Processing completed",
    processed_count: 0,
    failed_count: 0,
    details: []
  };

  try {
    // Get pending messages
    let query = supabase
      .from("messages")
      .select("id, caption, processing_state, processing_started_at, retry_count")
      .eq("processing_state", "pending")
      .is("caption", "not.null")
      .order("created_at", { ascending: false });

    if (specificIds && specificIds.length > 0) {
      query = supabase
        .from("messages")
        .select("id, caption, processing_state, processing_started_at, retry_count")
        .in("id", specificIds);
    }

    query = query.limit(limit);
    const { data: messages, error } = await query;

    if (error) {
      throw new Error(`Error fetching pending messages: ${error.message}`);
    }

    if (!messages || messages.length === 0) {
      return {
        success: true,
        message: "No pending messages found to process",
        processed_count: 0,
        failed_count: 0,
        details: []
      };
    }

    // Process each message
    const results = await Promise.all(
      messages.map(async (message) => {
        try {
          if (detailedLogs) {
            console.log(`Processing message ${message.id} with caption: ${message.caption?.substring(0, 30)}...`);
          }

          // Call the parse-caption endpoint
          const response = await fetch(
            `${supabaseUrl}/functions/v1/parse-caption`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                messageId: message.id,
                caption: message.caption,
                correlationId: crypto.randomUUID(),
                force_reprocess: message.retry_count > 0,
                retryCount: message.retry_count || 0
              })
            }
          );

          // Parse the response
          const result = await response.json();
          const success = result.success === true;

          return {
            message_id: message.id,
            success,
            status_code: response.status,
            response_data: detailedLogs ? result : undefined,
            error: success ? undefined : (result.error || "Unknown error")
          };
        } catch (err) {
          console.error(`Error processing message ${message.id}:`, err);
          return {
            message_id: message.id,
            success: false,
            error: err instanceof Error ? err.message : String(err)
          };
        }
      })
    );

    // Count successes and failures
    response.processed_count = results.filter(r => r.success).length;
    response.failed_count = results.length - response.processed_count;
    response.details = results;
    response.message = `Processed ${response.processed_count} messages, ${response.failed_count} failed`;

    return response;
  } catch (error) {
    console.error("Error in forcePendingMessagesProcessing:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      processed_count: 0,
      failed_count: 0,
      details: []
    };
  }
}

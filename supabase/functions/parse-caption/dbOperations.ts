
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

/**
 * Get message by ID from the database
 */
export async function getMessage(messageId: string) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error(`Error in getMessage for ${messageId}:`, error);
    throw error;
  }
}

/**
 * Log an analysis event to the audit logs
 */
export async function logAnalysisEvent(
  messageId: string,
  correlationId: string,
  oldState: any,
  newState: any,
  metadata: Record<string, any> = {}
) {
  try {
    await supabase.from("unified_audit_logs").insert({
      event_type: "caption_analyzed",
      entity_id: messageId,
      correlation_id: correlationId,
      previous_state: oldState,
      new_state: newState,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging analysis event for message ${messageId}:`, error);
    // Non-fatal, continue execution
  }
}

/**
 * Update a message with its analyzed content
 */
export async function updateMessageWithAnalysis(
  messageId: string,
  analyzedContent: any,
  message?: any,
  queueId?: string,
  isEdit: boolean = false
) {
  try {
    // Prepare the updates
    const updates: Record<string, unknown> = {
      analyzed_content: analyzedContent,
      processing_state: "completed",
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null // Clear any previous errors
    };

    // Handle edit case - store old content in history
    if (isEdit && message?.analyzed_content) {
      // Store previous content in edit_history if this is an edit
      if (!Array.isArray(message.old_analyzed_content)) {
        updates.old_analyzed_content = [message.analyzed_content];
      } else {
        updates.old_analyzed_content = [...message.old_analyzed_content, message.analyzed_content];
      }

      updates.is_edited = true;
      updates.edit_date = new Date().toISOString();

      // Increment edit count
      updates.edit_count = (message.edit_count || 0) + 1;
    }

    // Extract fields for dedicated columns - only update known columns
    if (analyzedContent) {
      // Always store full parsed content in analyzed_content
      updates.analyzed_content = analyzedContent;

      // Only update dedicated columns for these specific fields
      if (analyzedContent.product_name !== undefined) {
        updates.product_name = analyzedContent.product_name;
      }
      if (analyzedContent.product_code !== undefined) {
        updates.product_code = analyzedContent.product_code;
      }
      if (analyzedContent.vendor_uid !== undefined) {
        updates.vendor_uid = analyzedContent.vendor_uid;
      }
      if (analyzedContent.purchase_date !== undefined) {
        updates.purchase_date = analyzedContent.purchase_date;
      }
      // Update quantity field directly (as text)
      if (analyzedContent.quantity !== undefined) {
        updates.quantity = String(analyzedContent.quantity);
      }
      if (analyzedContent.notes !== undefined) {
        updates.notes = analyzedContent.notes;
      }
    }

    // Update the message
    const { error } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", messageId);

    if (error) {
      console.error(`Error updating message ${messageId} with analysis:`, error);
      throw new Error(`Database update error: ${error.message}`);
    }

    // If this is from a queue, update the queue record
    if (queueId) {
      const { error: queueError } = await supabase
        .from("analysis_queue")
        .update({
          status: "completed",
          updated_at: new Date().toISOString()
        })
        .eq("id", queueId);

      if (queueError) {
        console.error(`Error updating queue record ${queueId}:`, queueError);
        // Non-fatal, continue execution
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`Error in updateMessageWithAnalysis for message ${messageId}:`, error);
    throw error;
  }
}

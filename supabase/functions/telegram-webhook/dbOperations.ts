// Use the singleton client
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";
import { supabaseClient } from "../_shared/supabase.ts";
// Removed createSupabaseClient import
// Removed createClient import
// Removed Deno.env gets (client is imported)

// Removed local supabaseClient creation

/**
 * Legacy wrapper function for backwards compatibility - FIXED
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  errorMessage?: string
): Promise<void> {
  // Pass empty metadata object as the 4th argument
  await logProcessingEvent(
    eventType,
    entityId,
    correlationId,
    {}, // metadata
    errorMessage
  );
}

/**
 * Check if a message with the same Telegram message ID already exists in the database
 */
export async function checkDuplicateMessage(
  chatId: number,
  telegramMessageId: number
): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .eq("telegram_message_id", telegramMessageId)
    .limit(1);

  if (error) {
    console.error("Error checking for duplicate message:", error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Creates a new message record in the database
 * This is a unified function that handles both media and non-media messages
 * with improved duplicate handling and recovery
 */
interface MessageRecord {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  processing_state: string;
}

export async function createMessage(
  // client parameter removed, using imported singleton supabaseClient
  input: any, // Consider defining a stricter type for input
  logger?: any // Consider a stricter logger type
): Promise<{
  id?: string;
  success: boolean;
  error_message?: string;
  duplicate?: boolean;
  caption_changed?: boolean;
}> {
  try {
    // Set a longer timeout for complex operations
    const options = { timeoutMs: 30000 };

    // Prepare the full record data for upsert
    const fullRecordData: Record<string, any> = {
      telegram_message_id: input.telegram_message_id,
      chat_id: input.chat_id,
      chat_type: input.chat_type,
      chat_title: input.chat_title,
      caption: input.caption || "",
      text: input.text || input.message_text || "",
      file_id: input.file_id,
      file_unique_id: input.file_unique_id,
      media_group_id: input.media_group_id,
      mime_type: input.mime_type,
      mime_type_original: input.mime_type_original,
      file_size: input.file_size,
      width: input.width,
      height: input.height,
      duration: input.duration,
      storage_path: input.storage_path,
      public_url: input.public_url,
      processing_state: input.processing_state || "initialized",
      is_forward: !!input.forward_info, // Derive from forward_info
      is_edited_channel_post: input.is_edited_channel_post || false,
      correlation_id: input.correlation_id,
      message_url: input.message_url,
      is_duplicate: input.is_duplicate || false,
      duplicate_reference_id: input.duplicate_reference_id,
      old_analyzed_content: input.old_analyzed_content,
      telegram_data: input.telegram_data,
      forward_info: input.forward_info,
      edit_date: input.edit_date,
      edit_history: input.edit_history || [],
      storage_exists: input.storage_exists,
      storage_path_standardized: input.storage_path_standardized,
      updated_at: new Date().toISOString(),
    };

    // Ensure analyzed_content is properly formatted as JSONB
    if (input.analyzed_content) {
      try {
        // If it's already an object, stringify it
        if (typeof input.analyzed_content === 'object') {
          fullRecordData.analyzed_content = JSON.stringify(input.analyzed_content);
        }
        // If it's a string, parse it to validate JSON then stringify again
        else if (typeof input.analyzed_content === 'string') {
          const parsed = JSON.parse(input.analyzed_content);
          fullRecordData.analyzed_content = JSON.stringify(parsed);
        }
      } catch (e) {
        logger?.error('Invalid analyzed_content format:', e);
        throw new Error('analyzed_content must be valid JSON');
      }
    }

    // First, check if this exact message already exists (telegram_message_id + chat_id)
    let { data: existingMessage, error: lookupError } = await supabaseClient // Use imported client
      .from("messages")
      .select("id, caption, file_unique_id")
      .eq("telegram_message_id", input.telegram_message_id)
      .eq("chat_id", input.chat_id)
      .maybeSingle();

    if (lookupError) {
      logger?.error("Error looking up existing message:", lookupError);
      return { success: false, error_message: lookupError.message };
    }

    // If not exact duplicate, check for file duplicate
    if (!existingMessage?.id && input.file_unique_id) {
      const { data: fileDuplicate, error: fileLookupError } = await supabaseClient // Use imported client
        .from("messages")
        .select("id, caption")
        .eq("file_unique_id", input.file_unique_id)
        .limit(1);

      if (fileLookupError) {
        logger?.error("Error checking for file duplicate:", fileLookupError);
        return { success: false, error_message: fileLookupError.message };
      }

      if (fileDuplicate?.length) {
        existingMessage = fileDuplicate[0];
        // Reuse storage path from original
        fullRecordData.storage_path = null;
        fullRecordData.public_url = null;
        fullRecordData.is_duplicate = true;
        fullRecordData.duplicate_reference_id = existingMessage.id;
      }
    }

    let messageId: string | undefined;

    if (existingMessage?.id) {
      // Update existing message
      logger?.info(
        `Found existing message ${existingMessage.id}, updating with new data.`
      );

      // Preserve existing storage if this is a file duplicate
      if (fullRecordData.is_duplicate) {
        delete fullRecordData.storage_path;
        delete fullRecordData.public_url;
      }

      // Check if caption changed and needs reprocessing
      const captionChanged =
        input.caption && input.caption !== existingMessage.caption;

      if (captionChanged) {
        fullRecordData.processing_state = "pending";
        fullRecordData.analyzed_content = null;
      }

      const { error: updateError } = await supabaseClient // Use imported client
        .from("messages")
        .update(fullRecordData)
        .eq("id", existingMessage.id);

      if (updateError) {
        logger?.error("Failed to update existing message:", updateError);
        return { success: false, error_message: updateError.message };
      }
      messageId = existingMessage.id;
      logger?.success(`Successfully updated message ${messageId}`);

      return {
        id: messageId,
        success: true,
        duplicate: true,
        caption_changed: captionChanged,
      };
    } else {
      // Simplified flow - use the original file_unique_id
      // Let the database handle any uniqueness constraints

      // Add created_at only for new records
      fullRecordData.created_at = new Date().toISOString();

      try {
        // Insert new message
        logger?.info(
          `Inserting new record with file_unique_id: ${fullRecordData.file_unique_id}`
        );

        const { data: insertData, error: insertError } = await supabaseClient // Use imported client
          .from("messages")
          .insert(fullRecordData)
          .select("id")
          .single();

        if (insertError || !insertData?.id) {
          // If we hit a unique constraint error despite our checks
          if (
            insertError.code === "23505" &&
            insertError.message.includes("messages_file_unique_id_key")
          ) {
            logger?.warn(
              "Hit unique constraint despite checks, attempting recovery..."
            );

            // Generate a truly unique file_unique_id as a last resort
            const timestamp = Date.now();
            fullRecordData.file_unique_id = `${input.file_unique_id}_${timestamp}`;
            fullRecordData.is_duplicate = true;

            // Try again with the modified unique ID
            const { data: retryData, error: retryError } = await supabaseClient // Use imported client
              .from("messages")
              .insert(fullRecordData)
              .select("id")
              .single();

            if (retryError || !retryData?.id) {
              logger?.error(
                "Failed final retry to insert message:",
                retryError
              );
              return { success: false, error_message: retryError.message };
            }

            messageId = retryData.id;
            logger?.success(
              `Successfully inserted message with generated unique ID: ${messageId}`
            );
          } else {
            logger?.error("Failed to insert new message:", insertError);
            return { success: false, error_message: insertError.message };
          }
        } else {
          messageId = insertData.id;
          logger?.success(`Successfully inserted new message ${messageId}`);
        }
      } catch (insertError: unknown) { // Add type annotation
          const insertErrorMessage = insertError instanceof Error ? insertError.message : String(insertError);
          logger?.error("Exception during message insert:", insertErrorMessage);
          return {
            success: false,
            error_message: insertErrorMessage,
          };
        }
      }

    if (!messageId) {
      const errorMsg = "Failed to obtain message ID after insert/update.";
      logger?.error(errorMsg);
      return { success: false, error_message: errorMsg };
    }

    // Simplified flow - no duplicate file logging

    return { id: messageId, success: true };
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error("Exception in createMessage:", errorMessage);
    return {
      success: false,
      error_message: errorMessage,
    };
  }
}

/**
 * Updates message state with enhanced error handling
 */
export async function updateMessageState(
  messageId: string,
  state: "pending" | "processing" | "completed" | "error",
  errorMessage?: string
): Promise<boolean> {
  if (!messageId) return false;

  try {
    const updates: Record<string, unknown> = {
      processing_state: state,
      updated_at: new Date().toISOString(),
    };

    switch (state) {
      case "processing":
        updates.processing_started_at = new Date().toISOString();
        break;
      case "completed":
        updates.processing_completed_at = new Date().toISOString();
        updates.error_message = null;
        break;
      case "error":
        if (errorMessage) {
          updates.error_message = errorMessage;
          updates.last_error_at = new Date().toISOString();
          // Assuming increment_retry_count exists and works as intended
          // updates.retry_count = supabaseClient.rpc("increment_retry_count", {
          //   message_id: messageId,
          // });
        }
        break;
    }

    const { error } = await supabaseClient
      .from("messages")
      .update(updates)
      .eq("id", messageId);

    if (error) {
      console.error(`Error updating message state: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating message state: ${errorMessage}`);
    return false;
  }
}

/**
 * Get message by ID with error handling
 */
export async function getMessageById(messageId: string) {
  if (!messageId) return null;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (error) {
      console.error(`Error getting message: ${error.message}`);
      return null;
    }

    return data;
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error getting message: ${errorMessage}`);
    return null;
  }
}

/**
 * Sync media group content from one message to others
 * FIXED: Using the correct parameter signature that matches the database function
 */
export async function syncMediaGroupContent(
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    // Call the database function with correct parameter types
    const { data, error } = await supabaseClient.rpc(
      "xdelo_sync_media_group_content",
      {
        p_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_force_sync: true, // Assuming force sync is always desired here
        p_sync_edit_history: false, // Assuming edit history sync is not needed here
      }
    );

    if (error) {
      console.error("Error syncing media group content:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      updatedCount: data?.updated_count || 0,
    };
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Exception in syncMediaGroupContent:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Recovers messages stuck in error state due to duplicate file_unique_id issues
 */
export async function recoverDuplicateFileMessages(
  correlationId: string = ""
): Promise<{ recovered: number; errors: number }> {
  try {
    const result = { recovered: 0, errors: 0 };

    // Find messages in error state with duplicate file_unique_id errors
    const { data: errorMessages, error: findError } = await supabaseClient
      .from("messages")
      .select("id, telegram_message_id, chat_id, file_unique_id, error_message")
      .eq("processing_state", "error")
      .ilike("error_message", "%file_unique_id%")
      .order("created_at", { ascending: false })
      .limit(50);

    if (findError) {
      console.error("Error finding stuck messages:", findError);
      return result;
    }

    if (!errorMessages || errorMessages.length === 0) {
      return result;
    }

    console.log(
      `Found ${errorMessages.length} messages to recover from duplicate file_unique_id errors`
    );

    // Process each message
    for (const message of errorMessages) {
      try {
        // Generate a truly unique ID using timestamp
        const timestamp = Date.now();
        const newUniqueId = `${message.file_unique_id}_${timestamp}`;

        // Update the message
        const { error: updateError } = await supabaseClient
          .from("messages")
          .update({
            file_unique_id: newUniqueId,
            is_duplicate: true,
            processing_state: "pending", // Reset to pending for reprocessing
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", message.id);

        if (updateError) {
          console.error(
            `Failed to recover message ${message.id}:`,
            updateError
          );
          result.errors++;
        } else {
          result.recovered++;

          // Log the recovery using the correct function and signature
          await logProcessingEvent(
            "message_recovered",
            message.id,
            correlationId || crypto.randomUUID(),
            { // metadata object
              telegram_message_id: message.telegram_message_id,
              chat_id: message.chat_id,
              original_file_unique_id: message.file_unique_id,
              new_file_unique_id: newUniqueId,
              recovery_type: "duplicate_file_id",
            }
            // No separate errorMessage needed here
          );
        }
      } catch (messageError: unknown) { // Add type annotation
        const errorMessage = messageError instanceof Error ? messageError.message : String(messageError);
        console.error(`Error recovering message ${message.id}:`, errorMessage);
        result.errors++;
      }
    }

    return result;
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in recoverDuplicateFileMessages:", errorMessage);
    return { recovered: 0, errors: 1 };
  }
}

// Added for parse-caption function
export async function logAnalysisEvent(
    messageId: string,
    correlationId: string,
    previousState: any,
    newState: any,
    metadata: any
): Promise<void> {
    await logProcessingEvent(
        'analysis_event',
        messageId,
        correlationId,
        { ...metadata, previousState, newState }
    );
}

export async function updateMessageWithAnalysis(
    messageId: string,
    parsedContent: any,
    message: any, // Consider defining type
    queue_id: string | undefined, // Assuming queue_id is string | undefined
    isEditOrForce: boolean
): Promise<any> { // Define return type
    const updates: any = {
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null, // Clear previous errors
    };
    // Add specific logic based on isEditOrForce if needed

    const { data, error } = await supabaseClient
        .from('messages')
        .update(updates)
        .eq('id', messageId)
        .select() // Select updated data if needed
        .single(); // Assuming only one row is updated

    if (error) {
        console.error(`Error updating message ${messageId} with analysis:`, error);
        // Optionally log error using logProcessingEvent
        throw new Error(`DB update failed: ${error.message}`);
    }
    return data; // Return updated data or success indicator
}

export async function getMessage(messageId: string): Promise<any> { // Define return type
    return getMessageById(messageId); // Reuse existing function
}

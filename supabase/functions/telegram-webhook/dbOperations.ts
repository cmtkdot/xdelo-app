import {
  createSupabaseClient,
  logProcessingEvent,
} from "../_shared/consolidatedMessageUtils.ts";

/**
 * Enhanced Supabase client with improved timeout and retry capabilities
 */
export const supabaseClient = createSupabaseClient({
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
});

/**
 * Legacy wrapper function for backwards compatibility
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
  errorMessage?: string
): Promise<void> {
  await logProcessingEvent(
    eventType,
    entityId,
    correlationId,
    metadata,
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
 * Creates a new message record in the database with enhanced duplicate handling
 */
interface MessageRecord {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  processing_state: string;
}

export async function createMessage(
  client: ReturnType<typeof createSupabaseClient>,
  input: any,
  logger?: any
): Promise<{
  id?: string;
  success: boolean;
  error_message?: string;
  duplicate?: boolean;
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
      is_forward: input.is_forward || false,
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

    // First, check if this exact message already exists
    let { data: existingMessage, error: lookupError } = await client
      .from("messages")
      .select("id")
      .eq("telegram_message_id", input.telegram_message_id)
      .eq("chat_id", input.chat_id)
      .maybeSingle();

    if (lookupError) {
      logger?.error("Error looking up existing message:", lookupError);
      return { success: false, error_message: lookupError.message };
    }

    // If message exists, just update last_seen_at
    if (existingMessage?.id) {
      logger?.info(`Found existing message ${existingMessage.id}, updating timestamp`);
      const { error: updateError } = await client
        .from("messages")
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingMessage.id);

      if (updateError) {
        logger?.error("Failed to update existing message:", updateError);
        return { success: false, error_message: updateError.message };
      }
      return { id: existingMessage.id, success: true, duplicate: true };
    }

    // Check for existing file with same file_unique_id
    const { data: existingFile, error: fileLookupError } = await client
      .from("messages")
      .select("id, storage_path, public_url")
      .eq("file_unique_id", input.file_unique_id)
      .maybeSingle();

    if (fileLookupError) {
      logger?.error("Error checking for duplicate file:", fileLookupError);
      return { success: false, error_message: fileLookupError.message };
    }

    // If file exists, mark as duplicate and reuse storage
    if (existingFile?.id) {
      logger?.info(`Found existing file ${existingFile.id}, marking as duplicate`);
      fullRecordData.is_duplicate = true;
      fullRecordData.duplicate_reference_id = existingFile.id;
      fullRecordData.storage_path = existingFile.storage_path;
      fullRecordData.public_url = existingFile.public_url;

      // Also update original file's duplicate count
      await client.rpc("increment_duplicate_count", {
        message_id: existingFile.id
      });
    }

    // Add created_at for new records
    fullRecordData.created_at = new Date().toISOString();

    // Insert new message
    const { data: insertData, error: insertError } = await client
      .from("messages")
      .insert(fullRecordData)
      .select("id")
      .single();

    if (insertError) {
      logger?.error("Failed to insert new message:", insertError);
      return { success: false, error_message: insertError.message };
    }

    return { id: insertData.id, success: true };
  } catch (error) {
    logger?.error("Exception in createMessage:", error);
    return {
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ... rest of the file remains unchanged ...

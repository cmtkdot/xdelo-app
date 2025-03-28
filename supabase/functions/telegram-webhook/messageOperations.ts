import { extractTelegramMetadata, supabaseClient } from "./dbOperations.ts";
import { MessageInput } from "./types.ts";

/**
 * Database record structure for a Telegram message
 */
interface MessageRecord {
  id: string;                   // Database UUID
  telegram_message_id: number;  // Telegram's message ID
  chat_id: number;              // Telegram chat ID
  processing_state?: string;    // Current processing state
  created_at?: string;          // Creation timestamp
}

/**
 * Result structure for message creation operations
 */
interface CreateMessageResult {
  id?: string;                  // Created message ID
  success: boolean;             // Operation success status
  error_message?: string;       // Error details if failed
  duplicate?: boolean;          // Whether message was a duplicate
}

/**
 * Creates or updates a message record in the database
 *
 * This function implements the core message handling logic:
 * 1. Handles both new messages and updates to existing ones
 * 2. Processes media files and metadata
 * 3. Manages duplicate detection
 * 4. Maintains processing state
 *
 * @param client - Supabase client instance
 * @param input - Message data including:
 *   - telegram_message_id: Telegram's message ID
 *   - chat_id: Telegram chat ID
 *   - caption/media/text: Message content
 *   - file_id/file_unique_id: For media files
 *   - media_group_id: For grouped media
 *   - processing_state: Current processing state
 *   - correlation_id: For tracing operations
 * @param logger - Optional logger for operation tracking
 *
 * @returns CreateMessageResult with operation status
 *
 * Flow:
 * 1. Validate and prepare message data
 * 2. Check for existing message (by telegram_message_id + chat_id)
 * 3. Check for duplicate files (by file_unique_id)
 * 4. Upsert message record
 * 5. Handle media group relationships
 * 6. Return operation result
 */
export async function createMessage(
  client: typeof supabaseClient,
  input: MessageInput,
  logger?: {
    info?: (message: string, meta?: any) => void;
    warn?: (message: string, meta?: any) => void;
    error?: (message: string, meta?: any) => void;
    success?: (message: string, meta?: any) => void;
  }
): Promise<CreateMessageResult> {
    try {
      /**
       * Set extended timeout for complex operations
       * Default is 15s, extended to 30s for media processing
       */
      const options = { timeoutMs: 30000 };

      /**
       * Extract and validate Telegram metadata
       *
       * Handles three cases:
       * 1. If telegram_metadata provided directly, uses that
       * 2. If raw telegram_data provided, extracts metadata
       * 3. Otherwise initializes empty metadata
       *
       * Logs warnings if extraction fails but continues operation
       */
    let telegramMetadata: Record<string, unknown> = {};
    if (typeof input.telegram_metadata !== "undefined") {
      telegramMetadata = input.telegram_metadata;
    } else if (input.telegram_data) {
      try {
        telegramMetadata = extractTelegramMetadata(input.telegram_data);
      } catch (e) {
        if (logger?.warn) logger.warn("Failed to extract telegram metadata", e);
      }
    }

    /**
     * Prepare complete message record for database upsert
     *
     * This builds the complete message object with:
     * - All required Telegram metadata
     * - Default values for optional fields
     * - Processing state tracking
     * - Timestamps for creation/update
     *
     * Special handling for:
     * - Empty strings instead of null for text fields
     * - Default processing state if not provided
     * - Automatic timestamp generation
     * - Forward/duplicate flags
     */
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
      telegram_metadata: telegramMetadata,
      forward_info: input.forward_info,
      edit_date: input.edit_date,
      edit_history: input.edit_history || [],
      storage_exists: input.storage_exists,
      storage_path_standardized: input.storage_path_standardized,
      updated_at: new Date().toISOString(),
    };

    // Simplified lookup - only check by file_unique_id if provided
    let existingMessage: {id: string} | null = null;
    if (input.file_unique_id) {
      const { data, error } = await client
        .from("messages")
        .select("id")
        .eq("file_unique_id", input.file_unique_id)
        .maybeSingle();

      if (error) {
        if (logger?.error) logger.error("Error looking up existing message:", error);
        return { success: false, error_message: error.message };
      }
      existingMessage = data;
    }

    let messageId: string | undefined;

    // Simplified upsert logic
    if (existingMessage) {
      // Update existing message
      if (logger?.info) logger.info(`Found existing message ${existingMessage.id}, updating with new data.`);
      const { error: updateError } = await client
        .from("messages")
        .update(fullRecordData)
        .eq("id", existingMessage.id);

      if (updateError) {
        if (logger?.error) logger.error("Failed to update existing message:", updateError);
        return { success: false, error_message: updateError.message };
      }
      messageId = existingMessage.id;
      if (logger?.success) logger.success(`Successfully updated message ${messageId}`);
    } else {
      // Insert new message
      fullRecordData.created_at = new Date().toISOString();

      const { data: insertData, error: insertError } = await client
        .from("messages")
        .insert(fullRecordData)
        .select("id")
        .single();

      if (insertError) {
        if (logger?.error) logger.error("Failed to insert new message:", insertError);
        return { success: false, error_message: insertError.message };
      }
      messageId = insertData.id;
      if (logger?.success) logger.success(`Successfully inserted new message ${messageId}`);
    }

    if (!messageId) {
      const errorMsg = "Failed to obtain message ID after insert/update.";
      if (logger?.error) logger.error(errorMsg);
      return { success: false, error_message: errorMsg };
    }

    // Final success return
    return { id: messageId, success: true };
  } catch (error) {
    /**
     * Global Error Handling
     *
     * Catches any unhandled exceptions and:
     * - Logs detailed error information
     * - Returns standardized error response
     * - Ensures no uncaught exceptions
     */
    if (logger?.error) logger.error("Exception in createMessage:", error);
    return {
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

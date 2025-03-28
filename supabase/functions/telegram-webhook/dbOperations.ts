import {
  createSupabaseClient,
  extractTelegramMetadata,
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
 * Check if a file with the same Telegram message ID already exists in the database
 * @param client Supabase client instance
 * @param telegramMessageId Telegram message ID
 * @param chatId Chat ID
 * @returns Boolean indicating if the file is a duplicate
 */
export async function checkDuplicateFile(
  client: any,
  telegramMessageId: number,
  chatId: number
): Promise<boolean> {
  const { data, error } = await client
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .eq("telegram_message_id", telegramMessageId)
    .limit(1);

  if (error) {
    console.error("Error checking for duplicate file:", error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Creates a new non-media message record in the database with transaction support
 */
export async function createNonMediaMessage(
  client: any,
  input: {
    telegram_message_id: number;
    chat_id: number;
    chat_type: string;
    chat_title?: string;
    message_type: string;
    message_text?: string;
    telegram_data: any;
    telegram_metadata?: any;
    processing_state?: string;
    is_forward?: boolean;
    correlation_id: string;
    message_url?: string;
  },
  logger?: any
): Promise<{ id?: string; success: boolean; error?: string }> {
  try {
    // If telegram_metadata is not provided, extract it from telegram_data
    const telegramMetadata =
      input.telegram_metadata || extractTelegramMetadata(input.telegram_data);

    // Create the message record using the other_messages table
    const { data, error } = await client
      .from("other_messages")
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        message_type: input.message_type,
        text: input.message_text || "",
        telegram_data: input.telegram_data,
        telegram_metadata: telegramMetadata,
        processing_state: input.processing_state || "initialized",
        is_forward: input.is_forward || false,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger?.error("Failed to create non-media message record:", error);
      return { success: false, error: error.message };
    }

    return { id: data.id, success: true };
  } catch (error) {
    logger?.error("Exception in createNonMediaMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a new media message record in the database with transaction support
 */
export async function createMediaMessage(input: {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  media_group_id?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  public_url?: string;
  telegram_data: any;
  processing_state?: string;
  is_forward?: boolean;
  correlation_id: string;
  message_url?: string;
}): Promise<{ id?: string; success: boolean; error?: string }> {
  try {
    // Extract essential metadata only
    const telegramMetadata = extractTelegramMetadata(input.telegram_data);

    // Create the message record
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        caption: input.caption || "",
        file_id: input.file_id,
        file_unique_id: input.file_unique_id,
        media_group_id: input.media_group_id,
        mime_type: input.mime_type,
        file_size: input.file_size,
        width: input.width,
        height: input.height,
        duration: input.duration,
        storage_path: input.storage_path,
        public_url: input.public_url,
        telegram_metadata: telegramMetadata,
        processing_state: input.processing_state || "initialized",
        is_forward: input.is_forward || false,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create media message record:", error);
      return { success: false, error: error.message };
    }

    return { id: data.id, success: true };
  } catch (error) {
    console.error("Exception in createMediaMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a new message record in the database
 * This is a unified function that handles both media and non-media messages
 * with improved duplicate handling and recovery
 */
export async function createMessage(
  client: any,
  input: any,
  logger?: any
): Promise<{ id?: string; success: boolean; error_message?: string; duplicate?: boolean }> {
  try {
    // Set a longer timeout for complex operations
    const options = { timeoutMs: 30000 };

    // Extract essential metadata
    const telegramMetadata =
      input.telegram_metadata ||
      (input.telegram_data ? extractTelegramMetadata(input.telegram_data) : {});

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
      telegram_metadata: telegramMetadata,
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

    // If we have a file_unique_id, also check for duplicate files
    let duplicateFileReference = null;
    if (input.file_unique_id && !existingMessage) {
      const { data: duplicateFile, error: fileCheckError } = await client
        .from("messages")
        .select("id, telegram_message_id, chat_id, processing_state, created_at")
        .eq("file_unique_id", input.file_unique_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fileCheckError) {
        logger?.error("Error checking for duplicate file:", fileCheckError);
      } else if (duplicateFile && duplicateFile.length > 0) {
        duplicateFileReference = duplicateFile[0];
        logger?.info(`Found existing file with same file_unique_id: ${duplicateFileReference.id}`);
        
        // If this is a resend of the same file in the same chat, treat it as an existing message
        if (duplicateFileReference.chat_id === input.chat_id) {
          existingMessage = { id: duplicateFileReference.id };
          logger?.info(`Treating as existing message since it's in the same chat: ${existingMessage.id}`);
        }
      }
    }

    let messageId: string | undefined;

    if (existingMessage) {
      // Update existing message
      logger?.info(
        `Found existing message ${existingMessage.id}, updating with new data.`
      );
      const { error: updateError } = await client
        .from("messages")
        .update(fullRecordData)
        .eq("id", existingMessage.id);

      if (updateError) {
        logger?.error("Failed to update existing message:", updateError);
        return { success: false, error_message: updateError.message };
      }
      messageId = existingMessage.id;
      logger?.success(`Successfully updated message ${messageId}`);
      
      // Return with success but flag as duplicate
      return { id: messageId, success: true, duplicate: true };
    } else {
      // If we found a duplicate file in a different chat, handle it specially
      if (duplicateFileReference) {
        // Add reference to the duplicate and mark as duplicate
        fullRecordData.is_duplicate = true;
        fullRecordData.duplicate_reference_id = duplicateFileReference.id;
        
        // Modify file_unique_id to avoid constraint violation
        // Append chat_id to make it unique
        fullRecordData.file_unique_id = `${input.file_unique_id}_${input.chat_id}`;
        
        logger?.info(`Modified file_unique_id to avoid constraint violation: ${fullRecordData.file_unique_id}`);
      }
      
      // Add created_at only for new records
      fullRecordData.created_at = new Date().toISOString();

      try {
        // Insert new message
        logger?.info(`Inserting new record with file_unique_id: ${fullRecordData.file_unique_id}`);
        
        const { data: insertData, error: insertError } = await client
          .from("messages")
          .insert(fullRecordData)
          .select("id")
          .single();

        if (insertError) {
          // If we hit a unique constraint error despite our checks
          if (insertError.code === "23505" && insertError.message.includes("messages_file_unique_id_key")) {
            logger?.warn("Hit unique constraint despite checks, attempting recovery...");
            
            // Generate a truly unique file_unique_id as a last resort
            const timestamp = Date.now();
            fullRecordData.file_unique_id = `${input.file_unique_id}_${timestamp}`;
            fullRecordData.is_duplicate = true;
            
            // Try again with the modified unique ID
            const { data: retryData, error: retryError } = await client
              .from("messages")
              .insert(fullRecordData)
              .select("id")
              .single();
              
            if (retryError) {
              logger?.error("Failed final retry to insert message:", retryError);
              return { success: false, error_message: retryError.message };
            }
            
            messageId = retryData.id;
            logger?.success(`Successfully inserted message with generated unique ID: ${messageId}`);
          } else {
            logger?.error("Failed to insert new message:", insertError);
            return { success: false, error_message: insertError.message };
          }
        } else {
          messageId = insertData.id;
          logger?.success(`Successfully inserted new message ${messageId}`);
        }
      } catch (insertError) {
        logger?.error("Exception during message insert:", insertError);
        return { 
          success: false, 
          error_message: insertError instanceof Error ? insertError.message : String(insertError)
        };
      }
    }

    if (!messageId) {
      const errorMsg = "Failed to obtain message ID after insert/update.";
      logger?.error(errorMsg);
      return { success: false, error_message: errorMsg };
    }

    // If we have a duplicate file, log the correlation
    if (duplicateFileReference) {
      try {
        await client.from("unified_audit_logs").insert({
          event_type: "duplicate_file_detected",
          entity_id: messageId,
          correlation_id: input.correlation_id,
          metadata: {
            original_file_id: duplicateFileReference.id,
            telegram_message_id: input.telegram_message_id,
            chat_id: input.chat_id,
            file_unique_id: input.file_unique_id,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        logger?.error("Failed to log duplicate file detection:", logError);
      }
    }

    return { id: messageId, success: true };
  } catch (error) {
    logger?.error("Exception in createMessage:", error);
    return {
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
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
          updates.retry_count = supabaseClient.rpc("increment_retry_count", {
            message_id: messageId,
          });
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
  } catch (error) {
    console.error(
      `Error updating message state: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
  } catch (error) {
    console.error(
      `Error getting message: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
        p_force_sync: true,
        p_sync_edit_history: false,
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
  } catch (error) {
    console.error("Exception in syncMediaGroupContent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Recovers messages stuck in error state due to duplicate file_unique_id issues
 */
export async function recoverDuplicateFileMessages(correlationId: string = ""): Promise<{ recovered: number; errors: number }> {
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
    
    console.log(`Found ${errorMessages.length} messages to recover from duplicate file_unique_id errors`);
    
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
            updated_at: new Date().toISOString()
          })
          .eq("id", message.id);
          
        if (updateError) {
          console.error(`Failed to recover message ${message.id}:`, updateError);
          result.errors++;
        } else {
          result.recovered++;
          
          // Log the recovery
          await xdelo_logProcessingEvent(
            "message_recovered",
            message.id,
            correlationId || crypto.randomUUID(),
            {
              telegram_message_id: message.telegram_message_id,
              chat_id: message.chat_id,
              original_file_unique_id: message.file_unique_id,
              new_file_unique_id: newUniqueId,
              recovery_type: "duplicate_file_id"
            }
          );
        }
      } catch (messageError) {
        console.error(`Error recovering message ${message.id}:`, messageError);
        result.errors++;
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error in recoverDuplicateFileMessages:", error);
    return { recovered: 0, errors: 1 };
  }
}

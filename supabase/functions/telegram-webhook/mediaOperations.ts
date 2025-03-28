import { supabaseClient } from "./dbOperations.ts";
import {
  xdelo_logProcessingEvent,
  extractTelegramMetadata
} from "./dbOperations.ts";

interface MediaMessageInput {
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
}

interface MediaMessageResult {
  id?: string;
  success: boolean;
  error?: string;
}

/**
 * Creates a new media message record in the database with transaction support
 */
export async function createMediaMessage(
  input: MediaMessageInput,
  logger?: {
    info?: (message: string, meta?: any) => void;
    error?: (message: string, meta?: any) => void;
  }
): Promise<MediaMessageResult> {
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
      if (logger?.error) logger.error("Failed to create media message record:", error);
      return { success: false, error: error.message };
    }

    if (logger?.info) logger.info("Successfully created media message", { id: data.id });
    return { id: data.id, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (logger?.error) logger.error("Exception in createMediaMessage:", errorMessage);

    try {
      await xdelo_logProcessingEvent(
        "media_message_error",
        input.telegram_message_id.toString(),
        input.correlation_id,
        {
          error: errorMessage,
          chat_id: input.chat_id,
          file_id: input.file_id
        }
      );
    } catch (logError) {
      if (logger?.error) logger.error("Failed to log processing event:", logError);
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

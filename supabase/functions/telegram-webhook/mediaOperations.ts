import { createMessage, xdelo_logProcessingEvent, supabaseClient } from "./dbOperations.ts";

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
 * Creates a new media message record in the database using the unified message creator
 */
export async function createMediaMessage(
  input: MediaMessageInput,
  logger?: {
    info?: (message: string, meta?: any) => void;
    error?: (message: string, meta?: any) => void;
  }
): Promise<MediaMessageResult> {
  try {
    const result = await createMessage(supabaseClient, input, logger);

    if (!result.success) {
      const errorMessage = result.error_message || "Unknown error creating message";
      if (logger?.error) logger.error("Failed to create media message:", errorMessage);

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

      return { success: false, error: errorMessage };
    }

    if (logger?.info) logger.info("Successfully created media message", { id: result.id });
    return { id: result.id, success: true };
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

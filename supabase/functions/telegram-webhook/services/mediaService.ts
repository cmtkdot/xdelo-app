
/**
 * Service for handling media operations
 */
import { xdelo_processMessageMedia } from "../../_shared/mediaStorage.ts";
import { TelegramMessage } from "../types.ts";
import { buildTelegramMessageUrl } from "../utils/urlBuilder.ts";
import { extractForwardInfo } from "../utils/messageUtils.ts";
import { TELEGRAM_BOT_TOKEN } from "../config/environment.ts";

/**
 * Processes media from a Telegram message
 */
export async function processMessageMedia(message: TelegramMessage): Promise<{
  success: boolean;
  fileInfo?: any;
  mediaData?: any;
  error?: string;
}> {
  try {
    // Extract media file details
    const telegramFile = message.photo
      ? message.photo[message.photo.length - 1]
      : message.video || message.document;

    if (!telegramFile?.file_id || !telegramFile?.file_unique_id) {
      throw new Error("Essential media file details missing");
    }

    // Process the media file
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );

    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }

    // Prepare media data payload
    const mediaData = {
      ...message,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      mime_type: mediaResult.fileInfo.mime_type,
      file_size: mediaResult.fileInfo.file_size || telegramFile.file_size,
      storage_exists: true,
      storage_path_standardized: true,
      forward_info: extractForwardInfo(message),
      message_url: buildTelegramMessageUrl(message.chat.id, message.message_id),
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      width: telegramFile && "width" in telegramFile ? telegramFile.width : undefined,
      height: telegramFile && "height" in telegramFile ? telegramFile.height : undefined,
      duration: message.video?.duration,
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
    };

    return {
      success: true,
      fileInfo: mediaResult.fileInfo,
      mediaData
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

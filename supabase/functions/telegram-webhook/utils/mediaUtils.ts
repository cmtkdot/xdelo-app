
import { 
  xdelo_getMediaInfoFromTelegram,
  xdelo_constructStoragePath,
  xdelo_getExtensionFromMedia,
  xdelo_uploadMediaToStorage,
  xdelo_checkFileExistsInStorage,
  xdelo_repairContentDisposition,
  xdelo_getFileExtension,
  xdelo_validateStoragePath
} from '../../_shared/mediaUtils.ts';

// Re-export all shared media utilities for use in the webhook
export {
  xdelo_getMediaInfoFromTelegram,
  xdelo_constructStoragePath,
  xdelo_getExtensionFromMedia,
  xdelo_uploadMediaToStorage,
  xdelo_checkFileExistsInStorage,
  xdelo_repairContentDisposition,
  xdelo_getFileExtension,
  xdelo_validateStoragePath
};

/**
 * Extended media detection with better MIME type handling
 * This function enhances the shared utility with webhook-specific behavior
 */
export async function xdelo_getTelegramMediaInfo(message: any, correlationId: string): Promise<any> {
  // Use the shared utility as the source of truth
  return await xdelo_getMediaInfoFromTelegram(message, correlationId);
}

/**
 * Webhook-specific implementation to validate media after upload
 */
export async function xdelo_validateAndRepairMedia(storagePath: string): Promise<boolean> {
  // Check if the file exists
  const exists = await xdelo_validateStoragePath(storagePath);
  
  if (!exists) {
    console.warn(`File does not exist at path: ${storagePath}`);
    return false;
  }
  
  // Always repair the content disposition to ensure proper viewing
  return await xdelo_repairContentDisposition(storagePath);
}

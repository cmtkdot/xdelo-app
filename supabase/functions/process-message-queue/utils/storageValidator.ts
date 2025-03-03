
import { StorageValidationResult } from "../types.ts";

/**
 * Validates a storage path based on file_unique_id and mime_type
 */
export function validateStoragePath(
  fileUniqueId: string,
  storagePath: string = '',
  mimeType: string = 'image/jpeg'
): StorageValidationResult {
  if (!fileUniqueId) {
    return {
      isValid: false,
      storagePath: '',
      publicUrl: '',
      needsRedownload: true
    };
  }
  
  // Extract extension from mime_type
  const extension = mimeType.split('/')[1] || 'jpeg';
  
  // Use the existing storage path if it exists and matches the file_unique_id pattern
  let validatedPath = storagePath && storagePath.includes(fileUniqueId)
    ? storagePath
    : `${fileUniqueId}.${extension}`;
    
  return {
    isValid: true,
    storagePath: validatedPath,
    publicUrl: constructPublicUrl(validatedPath),
    needsRedownload: !storagePath || storagePath === ''
  };
}

/**
 * Constructs a public URL for accessing the file
 */
export function constructPublicUrl(storagePath: string): string {
  if (!storagePath) return '';
  
  return `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${storagePath}`;
}

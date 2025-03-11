
import { StorageValidationResult } from "../types.ts";

/**
 * Gets a standardized file extension based on MIME type
 */
function getFileExtension(mimeType: string = 'image/jpeg'): string {
  // Extract the part after the slash
  const parts = mimeType.split('/');
  let extension = parts[1] || 'jpeg';
  
  // Handle special cases and normalize common extensions
  switch (extension) {
    case 'jpg':
      return 'jpeg';
    case 'quicktime':
      return 'mov';
    case 'x-matroska':
      return 'mkv';
    case 'octet-stream':
      return 'bin';
    default:
      return extension;
  }
}

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
  
  // Get standardized extension from mime_type
  const extension = getFileExtension(mimeType);
  
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

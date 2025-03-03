
/**
 * Validates and normalizes the storage path for a file
 */
export function validateStoragePath(
  fileUniqueId: string,
  storagePath: string,
  mimeType: string
): { storagePath: string; needsUpdate: boolean } {
  // Extract extension from mime_type
  const extension = mimeType 
    ? mimeType.split('/')[1] 
    : 'jpeg';  // Default to jpeg if no mime type
  
  // Standard format for storage path
  const standardPath = `${fileUniqueId}.${extension}`;
  
  // Check if storage path is missing or doesn't match the standard format
  const needsUpdate = !storagePath || 
                      !storagePath.startsWith(fileUniqueId) ||
                      storagePath !== standardPath;
  
  return {
    storagePath: standardPath,
    needsUpdate
  };
}

/**
 * Constructs a public URL for a file in storage
 */
export function constructPublicUrl(storagePath: string): string {
  return `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${storagePath}`;
}

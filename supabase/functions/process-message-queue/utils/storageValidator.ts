
/**
 * Validates and corrects storage paths for media files
 */
export function validateStoragePath(
  fileUniqueId: string, 
  storagePath: string | null, 
  mimeType: string | null
): { isValid: boolean, newPath?: string } {
  // If storage path is missing, generate one
  if (!storagePath || storagePath.trim() === '') {
    const extension = mimeType ? mimeType.split('/')[1] : 'jpeg';
    const newPath = `${fileUniqueId}.${extension}`;
    return { isValid: false, newPath };
  }
  
  // Check if the storage path contains the file_unique_id
  if (!storagePath.includes(fileUniqueId)) {
    const extension = mimeType ? mimeType.split('/')[1] : 'jpeg';
    const newPath = `${fileUniqueId}.${extension}`;
    return { isValid: false, newPath };
  }
  
  return { isValid: true };
}

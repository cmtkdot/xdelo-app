
/**
 * Validates and generates correct storage paths for media files
 */
export function validateStoragePath(
  fileUniqueId: string, 
  storagePath: string | null, 
  mimeType: string | null
): { storagePath: string, needsUpdate: boolean } {
  // Default extension
  const extension = mimeType ? mimeType.split('/')[1] : 'jpeg';
  
  // Generate the standard storage path format
  const standardPath = `${fileUniqueId}.${extension}`;
  
  // Check if the storage path needs to be updated
  const needsUpdate = !storagePath || 
                      storagePath.trim() === '' || 
                      !storagePath.includes(fileUniqueId);
  
  return { 
    storagePath: standardPath,
    needsUpdate
  };
}

/**
 * Constructs a public URL for a file in storage
 */
export function constructPublicUrl(storagePath: string, baseUrl?: string): string {
  const storageBaseUrl = baseUrl || 
    `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/`;
  
  return `${storageBaseUrl}${storagePath}`;
}

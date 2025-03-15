
// Improved function to find existing file
export async function xdelo_findExistingFile(
  supabase: any,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  try {
    if (!fileUniqueId) {
      return { exists: false };
    }
    
    // Find message with this file_unique_id
    const { data: existingMessages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !existingMessages?.length) {
      return { exists: false };
    }
    
    const existingMessage = existingMessages[0];
    
    // Verify the file actually exists in storage
    if (existingMessage.storage_path) {
      const { xdelo_verifyFileExists } = await import('./uploadUtils.ts');
      const storageExists = await xdelo_verifyFileExists(
        supabase, 
        existingMessage.storage_path
      );
      
      if (storageExists) {
        return { exists: true, message: existingMessage };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error finding existing file:', error);
    return { exists: false };
  }
}

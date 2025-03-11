
import { supabaseClient as supabase } from "./supabase.ts";
import { getStoragePublicUrl } from "./urls.ts";

export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string
): Promise<{success: boolean, publicUrl?: string}> {
  try {
    // Upload to storage with upsert enabled, let Supabase handle content type
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        upsert: true // Enable overwriting existing files
      });
      
    if (error) throw error;
    
    // Generate public URL
    const publicUrl = getStoragePublicUrl(storagePath);
    
    return { success: true, publicUrl };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return { success: false };
  }
}

// Check if file exists in storage
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  if (!bucket || !filePath) return false;
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath, { range: { offset: 0, length: 1 } });
      
    return !error && !!data;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}

// Check if a file exists directly in the storage bucket
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .list('', {
        search: fileUniqueId
      });
    
    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Error checking file existence in storage:', error);
    return false;
  }
}

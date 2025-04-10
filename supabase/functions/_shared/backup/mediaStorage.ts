
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Store file from URL to Supabase storage
export async function storeFileFromUrl(
  supabase: SupabaseClient,
  fileUrl: string,
  fileInfo: {
    path?: string;
    fileName: string;
    mimeType: string;
    bucket?: string;
  }
) {
  try {
    const bucket = fileInfo.bucket || 'message_media';
    const filePath = fileInfo.path ? `${fileInfo.path}/${fileInfo.fileName}` : fileInfo.fileName;
    
    // Fetch the file
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    // Convert the response to a blob
    const blob = await response.blob();
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: fileInfo.mimeType,
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return {
      success: true,
      path: filePath,
      publicUrl
    };
  } catch (error) {
    console.error("Error storing file from URL:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Generate a storage path for a file
export function generateStoragePath(
  messageId: string, 
  fileUniqueId: string,
  fileName: string,
  options?: {
    includeMessageId?: boolean;
    includeDate?: boolean;
  }
) {
  const pathParts = ['telegram'];
  
  // Add date-based folder structure
  if (options?.includeDate !== false) {
    const now = new Date();
    // Format: YYYY/MM
    pathParts.push(`${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`);
  }
  
  // Add message ID subfolder if requested
  if (options?.includeMessageId) {
    pathParts.push(messageId);
  }
  
  // Add file unique ID as prefix to prevent collisions
  const sanitizedFileName = sanitizeFileName(fileName);
  const finalFileName = `${fileUniqueId}_${sanitizedFileName}`;
  
  // Join path parts and add filename
  return `${pathParts.join('/')}/${finalFileName}`;
}

// Sanitize file name to be safe for storage
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w\s.-]/g, '_') // Replace non-word chars with underscore
    .replace(/\s+/g, '_')       // Replace spaces with underscore
    .toLowerCase();
}

// Check if file exists in storage
export async function checkFileExistsInStorage(
  supabase: SupabaseClient,
  filePath: string,
  bucket: string = 'message_media'
): Promise<boolean> {
  try {
    // List files with exact name match
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: filePath.substring(filePath.lastIndexOf('/') + 1)
      });
    
    if (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
    
    return data.length > 0;
  } catch (error) {
    console.error("Exception checking file existence:", error);
    return false;
  }
}

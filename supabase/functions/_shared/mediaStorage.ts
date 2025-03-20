import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_detectMimeType
} from "./mediaUtils.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export async function uploadMediaToStorage(
  bucket: string,
  path: string,
  file: ArrayBuffer,
  contentType: string,
  contentDisposition: 'inline' | 'attachment' = 'inline'
) {
  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        cacheControl: '3600',
        upsert: true,
        duplex: 'half',
        headers: {
          'Content-Disposition': contentDisposition
        }
      });

    if (error) throw error;
    
    // Get the public URL for the file
    const { data: publicUrlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return {
      success: true,
      path: data.path,
      publicUrl: publicUrlData.publicUrl
    };
  } catch (error) {
    console.error('Error uploading file to storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function updateFileContentType(
  bucket: string,
  path: string,
  contentType: string,
  contentDisposition: 'inline' | 'attachment' = 'inline'
) {
  try {
    // First, download the file with the wrong content type
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from(bucket)
      .download(path);
      
    if (downloadError) throw downloadError;
    
    // Then re-upload it with the correct content type
    const { success, path: newPath, publicUrl, error } = await uploadMediaToStorage(
      bucket,
      path,
      fileData,
      contentType,
      contentDisposition
    );
    
    if (!success) throw new Error(error);
    
    return {
      success: true,
      path: newPath,
      publicUrl,
      contentType,
      contentDisposition
    };
  } catch (error) {
    console.error('Error updating file content type:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find an existing file in the database by file_unique_id
 */
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .limit(1);

    if (error) {
      console.error('Error checking for existing file:', error);
      return { exists: false };
    }

    if (data && data.length > 0) {
      return { exists: true, message: data[0] };
    }

    return { exists: false };
  } catch (error) {
    console.error('Unexpected error checking for existing file:', error);
    return { exists: false };
  }
}

/**
 * Process message media from Telegram, handling download and upload
 */
export async function xdelo_processMessageMedia(
  message: any,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string,
  messageId?: string
): Promise<{ 
  success: boolean; 
  isDuplicate: boolean; 
  fileInfo: any; 
  error?: string 
}> {
  try {
    // First check if this is a duplicate file
    const { exists, message: existingMessage } = await xdelo_findExistingFile(
      // Get Supabase client
      createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      ),
      fileUniqueId
    );

    if (exists && existingMessage) {
      console.log(`Found existing file: ${fileUniqueId}`);
      
      // Return existing file info
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingMessage.storage_path,
          mime_type: existingMessage.mime_type,
          file_size: existingMessage.file_size,
          public_url: existingMessage.public_url
        }
      };
    }

    // Detect MIME type
    const detectedMimeType = xdelo_detectMimeType(message);
    
    // Download from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      fileId,
      fileUniqueId,
      detectedMimeType,
      telegramBotToken
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(`Failed to download media: ${downloadResult.error || 'Unknown error'}`);
    }
    
    // Upload to Supabase Storage
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath || `${fileUniqueId}.bin`,
      downloadResult.blob,
      downloadResult.mimeType || detectedMimeType,
      messageId
    );
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload media: ${uploadResult.error || 'Unknown error'}`);
    }
    
    // Return the file info
    return {
      success: true,
      isDuplicate: false,
      fileInfo: {
        storage_path: downloadResult.storagePath,
        mime_type: downloadResult.mimeType || detectedMimeType,
        file_size: downloadResult.blob.size,
        public_url: uploadResult.publicUrl
      }
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    return {
      success: false,
      isDuplicate: false,
      fileInfo: null,
      error: error.message || 'Unknown error processing media'
    };
  }
}

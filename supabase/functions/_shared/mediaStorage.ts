
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

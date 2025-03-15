
import { xdelo_isViewableMimeType } from './mimeTypes';
import { corsHeaders } from './corsUtils';

// Get upload options with proper content disposition
export function xdelo_getUploadOptions(mimeType: string): Record<string, any> {
  const isViewable = xdelo_isViewableMimeType(mimeType);
  
  return {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    cacheControl: '3600',
    contentDisposition: isViewable ? 'inline' : 'attachment'
  };
}

// Upload file to storage with improved error handling
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string,
  messageId?: string,
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    console.log(`Uploading file to storage: ${storagePath} with MIME type: ${mimeType}`);
    
    // Get correct upload options based on mime type
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    // Get Supabase client instance
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Import dynamically to avoid issues in edge function context
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.4');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Upload the file with retry for network stability
    let uploadError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileData, uploadOptions);
          
        if (!error) {
          uploadError = null;
          break;
        }
        
        uploadError = error;
        console.warn(`Upload attempt ${attempt}/3 failed for ${storagePath}: ${error.message}`);
        
        // Wait with exponential backoff before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      } catch (err) {
        uploadError = err;
        console.warn(`Upload attempt ${attempt}/3 failed for ${storagePath}: ${err.message}`);
        
        // Wait with exponential backoff before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    if (uploadError) {
      throw new Error(`Storage upload failed after 3 attempts: ${uploadError.message}`);
    }

    // Construct public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    console.log(`File uploaded successfully, public URL: ${publicUrl}`);
    
    // If messageId provided, update the message with the public URL
    if (messageId) {
      await supabase
        .from('messages')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          storage_exists: true,
          storage_path_standardized: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return { 
      success: true, 
      publicUrl
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Check if file exists in storage
export async function xdelo_verifyFileExists(
  supabase: any,
  storagePath: string,
  bucket: string = 'telegram-media'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);
    
    return !error && !!data;
  } catch (error) {
    console.error('Error verifying file existence:', error);
    return false;
  }
}

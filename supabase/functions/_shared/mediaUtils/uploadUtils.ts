
import { corsHeaders } from './corsUtils.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { xdelo_withNetworkRetry } from '../retryUtils.ts';

/**
 * Upload media to Supabase Storage with proper content type and retry logic
 */
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  blob: Blob,
  mimeType: string,
  messageId?: string
): Promise<{
  success: boolean;
  publicUrl?: string;
  error?: string;
  retryAttempts?: number;
}> {
  try {
    if (!storagePath) {
      throw new Error('Storage path is required');
    }
    
    console.log(`Uploading to storage: ${storagePath} with MIME type: ${mimeType}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Determine content disposition based on MIME type
    const isViewableInBrowser = mimeType.startsWith('image/') || 
      mimeType.startsWith('video/') || 
      mimeType === 'application/pdf';
    
    const contentDisposition = isViewableInBrowser ? 'inline' : 'attachment';
    
    console.log(`Using content disposition: ${contentDisposition} for ${mimeType}`);
    
    // Upload file to storage with retry logic
    await xdelo_withNetworkRetry(
      `supabase-storage-upload:${storagePath}`,
      async () => {
        const { error: uploadError } = await supabase
          .storage
          .from('telegram-media')
          .upload(storagePath, blob, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true,
            duplex: 'half',
            headers: {
              ...corsHeaders,
              'Content-Disposition': contentDisposition
            }
          });
        
        if (uploadError) {
          throw uploadError;
        }
        
        return true;
      },
      {
        maxRetries: 5,
        initialDelayMs: 1000,
        backoffFactor: 1.7
      }
    );
    
    // Get public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    console.log(`Successfully uploaded ${storagePath}, public URL: ${publicUrl}`);
    
    // If a message ID was provided, update the message with storage metadata
    if (messageId) {
      await xdelo_withNetworkRetry(
        `update-message-storage-metadata:${messageId}`,
        async () => {
          const { error } = await supabase
            .from('messages')
            .update({
              storage_path: storagePath,
              public_url: publicUrl,
              mime_type: mimeType,
              content_disposition: contentDisposition,
              storage_exists: true,
              storage_path_standardized: true,
              storage_metadata: {
                content_type: mimeType,
                content_disposition: contentDisposition,
                uploaded_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
            
          if (error) throw error;
          return true;
        },
        {
          maxRetries: 4
        }
      );
    }
    
    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return {
      success: false,
      error: `Upload failed: ${error.message}`,
      retryAttempts: error.retryAttempts || 0
    };
  }
}

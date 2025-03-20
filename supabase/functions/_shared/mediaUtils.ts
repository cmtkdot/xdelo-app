
import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Check if a MIME type is viewable in the browser
export const xdelo_isViewableMimeType = (mimeType: string): boolean => {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf'
  );
};

// Detect MIME type from Telegram message data
export const xdelo_detectMimeType = (telegramData: any): string => {
  if (telegramData.photo) {
    return 'image/jpeg';
  } else if (telegramData.video) {
    return telegramData.video.mime_type || 'video/mp4';
  } else if (telegramData.document) {
    return telegramData.document.mime_type || 'application/octet-stream';
  }
  return 'application/octet-stream';
};

// Get upload options based on MIME type
export const xdelo_getUploadOptions = (mimeType: string) => {
  const isViewable = xdelo_isViewableMimeType(mimeType);
  return {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: true,
    duplex: 'half',
    contentDisposition: isViewable ? 'inline' : 'attachment'
  };
};

// Generate a standardized storage path
export const xdelo_generateStoragePath = (fileUniqueId: string, mimeType: string): string => {
  let extension = 'bin';
  
  if (mimeType.startsWith('image/')) {
    extension = mimeType.split('/')[1];
  } else if (mimeType.startsWith('video/')) {
    extension = mimeType.split('/')[1];
  } else if (mimeType === 'application/pdf') {
    extension = 'pdf';
  }
  
  return `${fileUniqueId}.${extension}`;
};

// Validate and fix storage path
export const xdelo_validateAndFixStoragePath = (path: string): string => {
  // Remove any invalid characters
  return path.replace(/[^a-zA-Z0-9_\-.]/g, '_');
};

// Download media from Telegram
export const xdelo_downloadMediaFromTelegram = async (
  fileId: string,
  fileUniqueId: string,
  mimeType: string,
  telegramBotToken: string
): Promise<{ success: boolean; blob?: Blob; storagePath?: string; mimeType?: string; error?: string }> => {
  try {
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    console.log(`Fetching file info for ${fileId}`);
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      {
        method: 'GET',
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    if (!fileInfo.result?.file_path) {
      throw new Error(`Invalid file info response from Telegram: ${JSON.stringify(fileInfo)}`);
    }
    
    console.log(`Downloading file from path ${fileInfo.result.file_path}`);
    
    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      {
        method: 'GET',
        headers: corsHeaders
      }
    );
    
    const fileData = await fileDataResponse.blob();
    
    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }
    
    console.log(`Successfully downloaded file: ${fileData.size} bytes`);
    
    // Generate storage path
    const storagePath = xdelo_generateStoragePath(fileUniqueId, mimeType);
    
    return {
      success: true,
      blob: fileData,
      storagePath,
      mimeType
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    return {
      success: false,
      error: `Download failed: ${error.message}`
    };
  }
};

// Upload media to Supabase Storage
export const xdelo_uploadMediaToStorage = async (
  storagePath: string,
  blob: Blob,
  mimeType: string,
  messageId?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Determine content disposition based on MIME type
    const isViewable = xdelo_isViewableMimeType(mimeType);
    const contentDisposition = isViewable ? 'inline' : 'attachment';
    
    // Upload file to storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
        duplex: 'half',
        headers: {
          'Content-Disposition': contentDisposition
        }
      });
    
    if (uploadError) {
      throw uploadError;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    // If a message ID was provided, update the message with storage info
    if (messageId) {
      await supabase
        .from('messages')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          mime_type: mimeType,
          content_disposition: contentDisposition,
          storage_exists: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return {
      success: false,
      error: `Upload failed: ${error.message}`
    };
  }
};

// Main function to process message media
export const xdelo_processMessageMedia = async (
  telegramData: any,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string
): Promise<{ success: boolean; fileInfo: any; error?: string }> => {
  try {
    // Detect MIME type
    const mimeType = xdelo_detectMimeType(telegramData);
    console.log(`Detected MIME type: ${mimeType}`);
    
    // Download file from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      fileId,
      fileUniqueId,
      mimeType,
      telegramBotToken
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(downloadResult.error || 'Failed to download media from Telegram');
    }
    
    // Upload to Supabase Storage
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath!,
      downloadResult.blob,
      downloadResult.mimeType || mimeType
    );
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload media to storage');
    }
    
    // Extract media information
    const media = telegramData.photo ? 
      telegramData.photo[telegramData.photo.length - 1] : 
      telegramData.video || telegramData.document;
    
    const fileInfo = {
      storage_path: downloadResult.storagePath,
      public_url: uploadResult.publicUrl,
      mime_type: downloadResult.mimeType || mimeType,
      mime_type_original: telegramData.video?.mime_type || telegramData.document?.mime_type,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      width: media?.width,
      height: media?.height,
      duration: telegramData.video?.duration,
      file_size: media?.file_size || downloadResult.blob.size
    };
    
    return {
      success: true,
      fileInfo
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    return {
      success: false,
      fileInfo: null,
      error: error.message
    };
  }
};

// Export all functions
export {
  xdelo_isViewableMimeType,
  xdelo_detectMimeType,
  xdelo_getUploadOptions,
  xdelo_generateStoragePath,
  xdelo_validateAndFixStoragePath,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_processMessageMedia
};

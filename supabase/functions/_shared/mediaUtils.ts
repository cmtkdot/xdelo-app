import { SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "./cors.ts";

// Determine if a file should be viewable in browser based on its MIME type
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  return (
    mimeType.startsWith('image/') || 
    mimeType.startsWith('video/') || 
    mimeType.startsWith('audio/') || 
    mimeType.startsWith('text/') || 
    mimeType === 'application/pdf'
  );
}

// Get file extension from MIME type with improved mapping
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  const extensionMap: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
    'audio/wav': 'wav',
    
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/x-tgsticker': 'tgs',
    
    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    
    // Others
    'application/json': 'json',
    'application/xml': 'xml',
    'application/zip': 'zip'
  };

  // If we have an exact match, use it
  if (extensionMap[mimeType]) {
    return extensionMap[mimeType];
  }
  
  // Otherwise extract the subtype
  const subtype = mimeType.split('/')[1];
  if (subtype) {
    // Clean up the subtype (remove parameters, etc.)
    const cleanSubtype = subtype.split(';')[0].trim();
    return cleanSubtype || 'bin';
  }
  
  return 'bin'; // Default fallback
}

// Improved function to standardize MIME type from Telegram data
export function xdelo_detectMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  // Handle photo (always JPEG from Telegram)
  if (telegramData.photo) return 'image/jpeg';
  
  // Use mime_type from document if available
  if (telegramData.document?.mime_type) return telegramData.document.mime_type;
  
  // Use mime_type from video if available
  if (telegramData.video?.mime_type) return telegramData.video.mime_type;
  
  // Handle other media types
  if (telegramData.video) return 'video/mp4';
  if (telegramData.audio) return telegramData.audio.mime_type || 'audio/mpeg';
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  // Default fallback
  return 'application/octet-stream';
}

// Standardize storage path generation
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = xdelo_getExtensionFromMimeType(mimeType);
  return `${fileUniqueId}.${extension}`;
}

// Validate and fix a storage path if needed
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('File unique ID is required for storage path generation');
  }
  
  return xdelo_generateStoragePath(fileUniqueId, mimeType || 'application/octet-stream');
}

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

// Improved function to find existing file
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
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

// Check if file exists in storage
export async function xdelo_verifyFileExists(
  supabase: SupabaseClient,
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

// Upload file to storage with improved error handling
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string,
  messageId?: string, // Optional: directly update a message's public_url
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
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
    
    // Upload the file
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileData, uploadOptions);
    
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Construct public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    
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

// Download media from Telegram with improved error handling
export async function xdelo_downloadMediaFromTelegram(
  fileId: string,
  fileUniqueId: string,
  mimeType: string,
  telegramBotToken: string
): Promise<{ 
  success: boolean; 
  blob?: Blob; 
  storagePath?: string; 
  mimeType?: string;
  error?: string 
}> {
  try {
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      { headers: corsHeaders }
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      { headers: corsHeaders }
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();
    
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
      error: error.message
    };
  }
}

// Process media for a message with duplicate detection and improved error handling
export async function xdelo_processMessageMedia(
  telegramData: any,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Import dynamically to avoid issues in edge function context
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.4');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Step 1: Check if this file already exists in our system
    const { exists, message: existingMessage } = await xdelo_findExistingFile(
      supabase,
      fileUniqueId
    );
    
    // If file exists and is properly stored, reuse it
    if (exists && existingMessage) {
      console.log(`Duplicate file detected: ${fileUniqueId}, reusing existing file`);
      
      // If messageId provided, update the message to reference existing file
      if (messageId) {
        await supabase
          .from('messages')
          .update({
            is_duplicate: true,
            duplicate_reference_id: existingMessage.id,
            storage_path: existingMessage.storage_path,
            public_url: existingMessage.public_url,
            mime_type: existingMessage.mime_type,
            storage_exists: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
      
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingMessage.storage_path,
          public_url: existingMessage.public_url,
          mime_type: existingMessage.mime_type,
          file_id: fileId,
          file_unique_id: fileUniqueId,
          width: existingMessage.width,
          height: existingMessage.height,
          duration: existingMessage.duration,
          file_size: existingMessage.file_size
        }
      };
    }
    
    // Step 2: Not a duplicate, need to download and process the file
    console.log(`New file detected: ${fileUniqueId}, downloading from Telegram`);
    
    // Step 3: Determine MIME type
    const mimeType = xdelo_detectMimeType(telegramData);
    
    // Step 4: Download file from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      fileId,
      fileUniqueId,
      mimeType,
      telegramBotToken
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(downloadResult.error || 'Failed to download media from Telegram');
    }
    
    // Step 5: Upload to storage with proper content disposition
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath,
      downloadResult.blob,
      mimeType,
      messageId // Pass messageId for direct update
    );
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload media to storage');
    }
    
    // Step 6: Get media dimensions
    const media = telegramData.photo ? 
      telegramData.photo[telegramData.photo.length - 1] : 
      telegramData.video || telegramData.document;
    
    const fileInfo = {
      storage_path: downloadResult.storagePath,
      public_url: uploadResult.publicUrl,
      mime_type: mimeType,
      mime_type_original: telegramData.video?.mime_type || telegramData.document?.mime_type,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      width: media?.width,
      height: media?.height,
      duration: telegramData.video?.duration,
      file_size: media?.file_size
    };
    
    // Step 7: If messageId provided but not yet updated (because we didn't pass it to uploadMediaToStorage)
    if (messageId && !uploadResult.publicUrl) {
      await supabase
        .from('messages')
        .update({
          ...fileInfo,
          is_duplicate: false,
          storage_exists: true,
          storage_path_standardized: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return {
      success: true,
      isDuplicate: false,
      fileInfo
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    return {
      success: false,
      isDuplicate: false,
      fileInfo: null,
      error: error.message
    };
  }
}

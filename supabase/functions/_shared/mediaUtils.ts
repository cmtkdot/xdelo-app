import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
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
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/ogg': 'ogv',
    'video/mpeg': 'mpg',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/x-tgsticker': 'tgs',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    
    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'text/csv': 'csv',
    
    // Others
    'application/json': 'json',
    'application/xml': 'xml',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/x-7z-compressed': '7z',
    'application/x-rar-compressed': 'rar'
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

// Improved function to detect and standardize MIME type from Telegram data
export function xdelo_detectMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  // Log the telegram data for debugging
  console.log('Detecting MIME type from telegram data:', JSON.stringify({
    has_photo: !!telegramData.photo,
    has_document: !!telegramData.document,
    has_video: !!telegramData.video,
    document_mime_type: telegramData.document?.mime_type,
    video_mime_type: telegramData.video?.mime_type
  }));
  
  // Handle photo (always JPEG from Telegram)
  if (telegramData.photo && telegramData.photo.length > 0) {
    return 'image/jpeg';
  }
  
  // Use mime_type from document if available
  if (telegramData.document?.mime_type) {
    // Log the document MIME type being used
    console.log(`Using document mime_type: ${telegramData.document.mime_type}`);
    return telegramData.document.mime_type;
  }
  
  // Use mime_type from video if available
  if (telegramData.video?.mime_type) {
    // Log the video MIME type being used
    console.log(`Using video mime_type: ${telegramData.video.mime_type}`);
    return telegramData.video.mime_type;
  }
  
  // Handle other media types with specific detection
  if (telegramData.video) return 'video/mp4';
  if (telegramData.audio) return telegramData.audio.mime_type || 'audio/mpeg';
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  // If we made it here without finding a MIME type, log a warning
  console.warn('Could not detect MIME type from telegram data, falling back to octet-stream');
  
  // Default fallback
  return 'application/octet-stream';
}

// Standardize storage path generation
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('Missing file_unique_id for storage path generation');
  }
  
  const extension = xdelo_getExtensionFromMimeType(mimeType || 'application/octet-stream');
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

/**
 * Enhanced fetch function with exponential backoff retry logic
 * @param url The URL to fetch
 * @param options Fetch options
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelay Initial delay between retries in ms
 * @returns The fetch response
 */
async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  initialRetryDelay: number = 500
): Promise<Response> {
  let retryCount = 0;
  let retryDelay = initialRetryDelay;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add timeout to avoid hanging requests using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal
      };
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      // Check if response is OK (status 200-299)
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Log the retry attempt
      console.warn(`Fetch attempt ${retryCount}/${maxRetries} failed for ${url}: ${error.message}`);
      
      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
        console.error(`All ${maxRetries} retry attempts failed for ${url}`);
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Exponential backoff with jitter to avoid thundering herd
      retryDelay = retryDelay * 2 * (0.9 + Math.random() * 0.2);
    }
  }
  
  // This should never execute but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch');
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
    
    console.log(`Fetching file info for ${fileId}\n`);
    
    // Get file info from Telegram with retry logic
    const fileInfoResponse = await xdelo_fetchWithRetry(
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
    
    // Download file from Telegram with retry logic
    const fileDataResponse = await xdelo_fetchWithRetry(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      { 
        method: 'GET',
        headers: corsHeaders
      }
    );
    
    const fileData = await fileDataResponse.blob();
    
    // Validate the downloaded data
    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }
    
    // Try to detect MIME type from file extension if not provided
    let detectedMimeType = mimeType;
    if (!detectedMimeType || detectedMimeType === 'application/octet-stream') {
      // Extract extension from file_path
      const extension = fileInfo.result.file_path.split('.').pop()?.toLowerCase();
      if (extension) {
        // Map common extensions back to MIME types
        const extensionMimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        
        if (extensionMimeMap[extension]) {
          detectedMimeType = extensionMimeMap[extension];
          console.log(`Detected MIME type from file extension: ${detectedMimeType}`);
        }
      }
    }
    
    // Generate storage path
    const storagePath = xdelo_generateStoragePath(fileUniqueId, detectedMimeType);
    console.log(`Generated storage path: ${storagePath} with MIME type: ${detectedMimeType}`);
    
    return {
      success: true,
      blob: fileData,
      storagePath,
      mimeType: detectedMimeType
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
    console.log(`Detected MIME type: ${mimeType} for file ${fileUniqueId}`);
    
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
      downloadResult.mimeType || mimeType,
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
      mime_type: downloadResult.mimeType || mimeType,
      mime_type_original: telegramData.video?.mime_type || telegramData.document?.mime_type,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      width: media?.width,
      height: media?.height,
      duration: telegramData.video?.duration,
      file_size: media?.file_size || downloadResult.blob.size
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

// Track rate limits for Telegram API to avoid hitting limits
const rateLimitTracker = {
  lastRequestTime: 0,
  requestCount: 0,
  reset() {
    this.lastRequestTime = Date.now();
    this.requestCount = 0;
  },
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    // If it's been more than a minute, reset the counter
    if (elapsed > 60000) {
      this.reset();
      return;
    }
    
    // Telegram's rate limit is roughly 30 requests per second
    // We'll be conservative and limit to 20 per second
    this.requestCount++;
    
    if (this.requestCount > 20) {
      // Wait until the next second before proceeding
      const waitTime = Math.max(1000 - elapsed, 100);
      console.log(`Rate limit approaching, waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.reset();
    }
  }
};

// Export rate limit tracker for other modules to use
export { rateLimitTracker };

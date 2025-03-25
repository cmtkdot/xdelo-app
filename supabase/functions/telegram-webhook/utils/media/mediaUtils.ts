import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../cors.ts";

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
 * Enhanced fetch function with exponential backoff retry logic and improved error handling
 */
async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 5,
  initialRetryDelay: number = 500
): Promise<Response> {
  let retryCount = 0;
  let retryDelay = initialRetryDelay;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add timeout to avoid hanging requests using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal
      };
      
      // Add detailed logging for debugging
      console.log(`Attempt ${retryCount + 1}/${maxRetries} to fetch ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      // Check if response is OK (status 200-299)
      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to get response text');
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${responseText.substring(0, 200)}`);
      }
      
      console.log(`Successfully fetched ${url.substring(0, 100)} on attempt ${retryCount + 1}`);
      return response;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Classify errors for better handling
      const isNetworkError = error.message.includes('NetworkError') || 
                            error.message.includes('network') ||
                            error.message.includes('Failed to fetch');
                            
      const isTimeoutError = error.name === 'AbortError' || 
                            error.message.includes('timeout') ||
                            error.message.includes('aborted');
                            
      const isServerError = error.message.includes('5') && 
                           error.message.includes('HTTP error');
      
      // Enhanced logging with error classification
      console.warn(`Fetch attempt ${retryCount}/${maxRetries} failed for ${url.substring(0, 100)}: 
        Error: ${error.message}
        Type: ${isNetworkError ? 'Network Error' : isTimeoutError ? 'Timeout' : isServerError ? 'Server Error' : 'Other'}
        Will ${retryCount < maxRetries ? `retry in ${retryDelay}ms` : 'not retry'}`);
      
      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
        console.error(`All ${maxRetries} retry attempts failed for ${url.substring(0, 100)}`);
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Exponential backoff with jitter to avoid thundering herd
      // More aggressive backoff for network errors, more patient for server errors
      const backoffFactor = isNetworkError ? 1.5 : isServerError ? 2.5 : 2;
      retryDelay = Math.min(
        retryDelay * backoffFactor * (0.8 + Math.random() * 0.4),
        60000
      );
    }
  }
  
  // This should never execute but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch');
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
  error?: string;
  attempts?: number;
}> {
  try {
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    console.log(`Starting download process for file ${fileId} (${fileUniqueId})`);
    
    // Get file info from Telegram with improved retry logic
    console.log(`Fetching file info for ${fileId}`);
    
    const fileInfoResponse = await xdelo_fetchWithRetry(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      { 
        method: 'GET',
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      },
      5,
      800
    );
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    if (!fileInfo.result?.file_path) {
      throw new Error(`Invalid file info response from Telegram: ${JSON.stringify(fileInfo)}`);
    }
    
    console.log(`Successfully retrieved file path: ${fileInfo.result.file_path}`);
    
    // Download file from Telegram with enhanced retry logic
    console.log(`Downloading file from path ${fileInfo.result.file_path}`);
    
    const fileDataResponse = await xdelo_fetchWithRetry(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      { 
        method: 'GET',
        headers: corsHeaders
      },
      5,
      1000
    );
    
    const fileData = await fileDataResponse.blob();
    
    // Validate the downloaded data
    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }
    
    console.log(`Successfully downloaded file: ${fileData.size} bytes`);
    
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
      mimeType: detectedMimeType,
      attempts: 1
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // Add more detailed error information for debugging
    const errorDetails = {
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      file_id: fileId,
      file_unique_id: fileUniqueId
    };
    
    console.error('Download error details:', JSON.stringify(errorDetails, null, 2));
    
    return {
      success: false,
      error: `Download failed: ${error.message}`,
      attempts: 5
    };
  }
} 
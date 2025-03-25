import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "./cors.ts";

// Create Supabase client for storage operations
const createSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
};

// Rate limiter to prevent API throttling
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private maxConcurrent: number;
  private delay: number;
  private activeRequests = 0;

  constructor(maxConcurrent = 5, delayMs = 300) {
    this.maxConcurrent = maxConcurrent;
    this.delay = delayMs;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processNext();
        }
      });
      
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const task = this.queue.shift();
      if (task) {
        this.activeRequests++;
        task();
        
        // Add delay between API calls
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }
    }
    
    this.processing = false;
  }

  reset() {
    this.queue = [];
    this.activeRequests = 0;
    this.processing = false;
  }
}

// Create a global rate limiter for API calls
export const rateLimitTracker = new RateLimiter(3, 500);

/**
 * Validates a Telegram file ID to ensure it meets expected format
 * @param fileId The Telegram file ID to validate
 * @returns Object with validation result, sanitized ID and optional error
 */
export function xdelo_validateFileId(fileId: string): { 
  isValid: boolean; 
  sanitizedFileId: string;
  error?: string;
} {
  if (!fileId) {
    return { 
      isValid: false, 
      sanitizedFileId: '', 
      error: 'File ID is empty or undefined' 
    };
  }
  
  // Telegram file IDs should not contain spaces, newlines or special characters
  // They're typically alphanumeric with some hyphens and underscores
  const sanitizedFileId = fileId.trim();
  
  // Basic validation - file IDs are typically at least 20 chars
  if (sanitizedFileId.length < 20) {
    return { 
      isValid: false, 
      sanitizedFileId, 
      error: `File ID seems too short (${sanitizedFileId.length} chars)` 
    };
  }
  
  // Check for invalid characters
  if (!/^[A-Za-z0-9_-]+$/g.test(sanitizedFileId)) {
    return { 
      isValid: false, 
      sanitizedFileId, 
      error: 'File ID contains invalid characters' 
    };
  }
  
  return { isValid: true, sanitizedFileId };
}

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
  
  // Handle photo (always JPEG from Telegram)
  if (telegramData.photo && telegramData.photo.length > 0) {
    return 'image/jpeg';
  }
  
  // Use mime_type from document if available
  if (telegramData.document?.mime_type) {
    return telegramData.document.mime_type;
  }
  
  // Use mime_type from video if available
  if (telegramData.video?.mime_type) {
    return telegramData.video.mime_type;
  }
  
  // Handle other media types with specific detection
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
  
  while (retryCount < maxRetries) {
    try {
      // Add timeout to avoid hanging requests using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal
      };
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      // Check if response is OK (status 200-299)
      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to get response text');
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${responseText.substring(0, 200)}`);
      }
      
      return response;
    } catch (error) {
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
      
      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
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
  
  throw new Error(`Failed after ${maxRetries} attempts with no response`);
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
 * Check if a file exists in storage
 */
export async function xdelo_verifyFileExists(
  supabase: SupabaseClient,
  storagePath: string,
  bucket: string = 'telegram-media'
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .getPublicUrl(storagePath);
      
    if (error || !data) {
      return false;
    }
    
    // Try to fetch the head of the file to verify it exists
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Error verifying file existence: ${error.message}`);
    return false;
  }
}

/**
 * Upload media to Supabase Storage
 */
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string,
  messageId?: string,
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    // Validate inputs
    if (!storagePath) {
      throw new Error('Storage path is required');
    }
    
    if (!fileData || fileData.size === 0) {
      throw new Error('File data is empty or invalid');
    }
    
    const supabase = createSupabaseClient();
    
    // Get appropriate upload options based on MIME type
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    // Use rate limiter to prevent API throttling
    return await rateLimitTracker.add(async () => {
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .upload(storagePath, fileData, uploadOptions);
        
      if (error) {
        if (error.message.includes('The resource already exists') || 
            error.message.includes('duplicate')) {
          // File already exists, which is fine - get its URL
          const { data: urlData } = await supabase
            .storage
            .from(bucket)
            .getPublicUrl(storagePath);
            
          return {
            success: true,
            publicUrl: urlData.publicUrl
          };
        }
        
        throw new Error(`Upload error: ${error.message}`);
      }
      
      // Get public URL
      const { data: urlData } = await supabase
        .storage
        .from(bucket)
        .getPublicUrl(storagePath);
        
      return {
        success: true,
        publicUrl: urlData.publicUrl
      };
    });
  } catch (error) {
    console.error(`Failed to upload media: ${error.message}`);
    return {
      success: false,
      error: `Upload failed: ${error.message}`
    };
  }
}

/**
 * Download media from Telegram API
 */
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
    // Validate inputs
    if (!fileId) {
      throw new Error('File ID is required');
    }
    
    if (!fileUniqueId) {
      throw new Error('File unique ID is required');
    }
    
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    // Validate the file ID
    const { isValid, sanitizedFileId, error: validationError } = xdelo_validateFileId(fileId);
    if (!isValid) {
      throw new Error(`Invalid file ID: ${validationError}`);
    }
    
    // Generate storage path
    const standardStoragePath = xdelo_validateAndFixStoragePath(
      fileUniqueId,
      mimeType
    );
    
    // First, get the file path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${sanitizedFileId}`;
    
    // Use rate limiter to prevent API throttling
    const getFileResponse = await rateLimitTracker.add(async () => 
      xdelo_fetchWithRetry(getFileUrl)
    );
    
    const fileInfo = await getFileResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      throw new Error(`Failed to get file info from Telegram: ${JSON.stringify(fileInfo)}`);
    }
    
    // Now download the actual file
    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
    
    const downloadResponse = await rateLimitTracker.add(async () => 
      xdelo_fetchWithRetry(downloadUrl)
    );
    
    // Create a blob from the response
    const blob = await downloadResponse.blob();
    
    // Return the downloaded file info
    return {
      success: true,
      blob: blob,
      storagePath: standardStoragePath,
      mimeType: mimeType
    };
  } catch (error) {
    console.error(`Failed to download media: ${error.message}`);
    return {
      success: false,
      error: `Download failed: ${error.message}`
    };
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
      createSupabaseClient(),
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

    // Validate the file ID
    const { isValid, sanitizedFileId, error: validationError } = xdelo_validateFileId(fileId);
    if (!isValid) {
      throw new Error(`Invalid file ID: ${validationError}`);
    }

    // Detect MIME type
    const detectedMimeType = xdelo_detectMimeType(message);
    
    // Download from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      sanitizedFileId,
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

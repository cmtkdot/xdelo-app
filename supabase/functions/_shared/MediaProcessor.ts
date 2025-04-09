import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from './cors.ts';
import { TelegramMessage } from '../telegram-webhook/types.ts';

/**
 * Media content extracted from a Telegram message
 */
export interface MediaContent {
  /** Unique identifier for the file */
  fileUniqueId: string;
  /** File ID used for downloading from Telegram */
  fileId: string;
  /** Width of the media (for photos and videos) */
  width?: number;
  /** Height of the media (for photos and videos) */
  height?: number;
  /** Duration in seconds (for videos) */
  duration?: number;
  /** MIME type of the media */
  mimeType?: string;
  /** Size of the file in bytes */
  fileSize?: number;
  /** Type of media (photo, video, document) */
  mediaType: 'photo' | 'video' | 'document';
}

/**
 * Result of a media download operation
 */
export interface DownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** The downloaded file as a Blob */
  blob?: Blob;
  /** Path where the file should be stored */
  storagePath?: string;
  /** Detected MIME type of the file */
  mimeType?: string;
  /** Error message if download failed */
  error?: string;
  /** Number of attempts made to download */
  attempts?: number;
}

/**
 * Result of a media upload operation
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Public URL of the uploaded file */
  publicUrl?: string;
  /** Error message if upload failed */
  error?: string;
}

/**
 * Result of a media processing operation
 */
export interface ProcessingResult {
  /** Status of the processing operation */
  status: 'success' | 'duplicate' | 'error' | 'download_failed_forwarded';
  /** File ID of the processed media */
  fileId: string;
  /** Unique identifier for the file */
  fileUniqueId: string;
  /** Path where the file is stored */
  storagePath: string | null;
  /** Public URL of the file */
  publicUrl: string | null;
  /** MIME type of the file */
  mimeType: string | null;
  /** File extension */
  extension: string | null;
  /** Error message if processing failed */
  error?: string;
}

/**
 * MediaProcessor class for handling Telegram media
 */
export class MediaProcessor {
  private supabaseClient: SupabaseClient;
  private telegramBotToken: string;
  private storageBucket: string;
  
  /**
   * Create a new MediaProcessor instance
   * 
   * @param supabaseClient - Initialized Supabase client
   * @param telegramBotToken - Telegram Bot API token
   * @param storageBucket - Name of the storage bucket (default: 'telegram-media')
   */
  constructor(
    supabaseClient: SupabaseClient,
    telegramBotToken: string,
    storageBucket: string = 'telegram-media'
  ) {
    this.supabaseClient = supabaseClient;
    this.telegramBotToken = telegramBotToken;
    this.storageBucket = storageBucket;
  }
  
  /**
   * Extract media content from a Telegram message
   * 
   * @param message - The Telegram message object
   * @returns The media content object or undefined if no media found
   * @example
   * const mediaContent = mediaProcessor.extractMediaContent(message);
   * if (mediaContent) {
   *   console.log(`Found ${mediaContent.mediaType} with ID ${mediaContent.fileId}`);
   * }
   */
  public extractMediaContent(message: TelegramMessage): MediaContent | undefined {
    if (!message) return undefined;
    
    // Extract photo (use the largest available)
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1];
      return {
        fileUniqueId: photo.file_unique_id,
        fileId: photo.file_id,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size,
        mediaType: 'photo'
      };
    }
    
    // Extract video
    if (message.video) {
      return {
        fileUniqueId: message.video.file_unique_id,
        fileId: message.video.file_id,
        width: message.video.width,
        height: message.video.height,
        duration: message.video.duration,
        mimeType: message.video.mime_type,
        fileSize: message.video.file_size,
        mediaType: 'video'
      };
    }
    
    // Extract document
    if (message.document) {
      return {
        fileUniqueId: message.document.file_unique_id,
        fileId: message.document.file_id,
        mimeType: message.document.mime_type,
        fileSize: message.document.file_size,
        mediaType: 'document'
      };
    }
    
    return undefined;
  }
  
  /**
   * Determine if a file should be viewable in browser based on its MIME type
   * 
   * @param mimeType - MIME type of the file
   * @returns Boolean indicating if the file should be viewable in browser
   * @example
   * const contentDisposition = mediaProcessor.isViewableMimeType('image/jpeg') 
   *   ? 'inline' 
   *   : 'attachment';
   */
  public isViewableMimeType(mimeType: string): boolean {
    if (!mimeType) return false;
    
    return (
      mimeType.startsWith('image/') || 
      mimeType.startsWith('video/') || 
      mimeType.startsWith('audio/') || 
      mimeType.startsWith('text/') || 
      mimeType === 'application/pdf'
    );
  }
  
  /**
   * Get file extension from MIME type with improved mapping
   * 
   * @param mimeType - MIME type of the file
   * @returns The file extension (without leading dot)
   * @example
   * const extension = mediaProcessor.getExtensionFromMimeType('image/jpeg'); // 'jpeg'
   */
  public getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      // Images
      'image/jpeg': 'jpeg', // Changed from 'jpg' to 'jpeg'
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
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar',
      'application/x-7z-compressed': '7z',
      'application/x-tar': 'tar',
      'application/gzip': 'gz',
      'application/x-bzip2': 'bz2',
      'text/plain': 'txt',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/json': 'json',
      'application/xml': 'xml',
      'application/octet-stream': 'bin'
    };
    
    return extensionMap[mimeType] || 'bin';
  }
  
  /**
   * Detect and standardize MIME type from Telegram data
   * 
   * @param message - The Telegram message object
   * @returns The detected MIME type
   * @example
   * const mimeType = mediaProcessor.detectMimeType(message);
   * console.log(`Detected MIME type: ${mimeType}`);
   */
  public detectMimeType(message: TelegramMessage): string {
    if (!message) return 'application/octet-stream';
    
    // Check for photo
    if (message.photo && message.photo.length > 0) {
      return 'image/jpeg'; // Telegram photos are always JPEG
    }
    
    // Check for video
    if (message.video) {
      return message.video.mime_type || 'video/mp4'; // Default to mp4 if not specified
    }
    
    // Check for document
    if (message.document) {
      // If document has a mime_type, use it
      if (message.document.mime_type) {
        return message.document.mime_type;
      }
      
      // Try to infer from filename if available
      if (message.document.file_name) {
        const extension = message.document.file_name.split('.').pop()?.toLowerCase();
        if (extension) {
          // Map common extensions back to mime types
          const extensionToMime: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            'mp3': 'audio/mpeg',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'xml': 'application/xml'
          };
          
          if (extensionToMime[extension]) {
            return extensionToMime[extension];
          }
        }
      }
    }
    
    // Default fallback
    return 'application/octet-stream';
  }
  
  /**
   * Generate a standardized storage path for a file
   * 
   * @param fileUniqueId - Unique identifier for the file
   * @param mimeType - MIME type of the file
   * @returns The storage path
   * @example
   * const storagePath = mediaProcessor.generateStoragePath('abc123', 'image/jpeg');
   * // Returns: 'abc123.jpeg'
   */
  public generateStoragePath(fileUniqueId: string, mimeType: string): string {
    const extension = this.getExtensionFromMimeType(mimeType);
    return `${fileUniqueId}.${extension}`;
  }
  
  /**
   * Check if a file already exists in the database
   * 
   * @param fileUniqueId - Unique identifier for the file
   * @returns Object with exists flag and message data if found
   * @example
   * const { exists, message } = await mediaProcessor.findExistingFile('abc123');
   * if (exists) {
   *   console.log(`File already exists with ID: ${message.id}`);
   * }
   */
  public async findExistingFile(fileUniqueId: string): Promise<{ exists: boolean; message?: any }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('messages')
        .select('*')
        .eq('file_unique_id', fileUniqueId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking for existing file:', error.message);
        return { exists: false };
      }
      
      return {
        exists: !!data,
        message: data
      };
    } catch (error) {
      console.error('Exception checking for existing file:', error);
      return { exists: false };
    }
  }
  
  /**
   * Check if a file exists in storage
   * 
   * @param storagePath - Path to the file in storage
   * @returns Boolean indicating if the file exists
   * @example
   * const exists = await mediaProcessor.verifyFileExists('abc123.jpeg');
   * console.log(`File ${exists ? 'exists' : 'does not exist'} in storage`);
   */
  public async verifyFileExists(storagePath: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient.storage
        .from(this.storageBucket)
        .list('', {
          limit: 1,
          search: storagePath
        });
      
      if (error) {
        console.error('Error verifying file exists:', error.message);
        return false;
      }
      
      return data && data.length > 0 && data[0].name === storagePath;
    } catch (error) {
      console.error('Exception verifying file exists:', error);
      return false;
    }
  }
  
  /**
   * Download media from Telegram with improved error handling
   * 
   * @param fileId - Telegram file ID
   * @param fileUniqueId - Unique identifier for the file
   * @param mimeType - MIME type of the file
   * @param correlationId - Request correlation ID for tracing
   * @returns Download result object
   * @example
   * const result = await mediaProcessor.downloadMediaFromTelegram(
   *   'abc123', 'def456', 'image/jpeg', 'corr-789'
   * );
   * if (result.success) {
   *   console.log(`Downloaded file: ${result.storagePath}`);
   * } else {
   *   console.error(`Download failed: ${result.error}`);
   * }
   */
  public async downloadMediaFromTelegram(
    fileId: string,
    fileUniqueId: string,
    mimeType: string,
    correlationId: string
  ): Promise<DownloadResult> {
    const functionName = 'downloadMediaFromTelegram';
    console.log(`[${correlationId}][${functionName}] Downloading file_id: ${fileId}`);
    
    // Validate inputs
    if (!fileId || !this.telegramBotToken) {
      return {
        success: false,
        error: !fileId ? 'Missing file_id' : 'Missing Telegram bot token'
      };
    }
    
    // Configure retry parameters
    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 500;
    const BACKOFF_FACTOR = 2;
    
    let lastError: string | null = null;
    let attempts = 0;
    
    // Get file path from Telegram
    let filePath: string | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      attempts++;
      
      try {
        if (attempt > 0) {
          const delayMs = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
          console.log(`[${correlationId}][${functionName}] Retrying getFile (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const getFileUrl = `https://api.telegram.org/bot${this.telegramBotToken}/getFile?file_id=${fileId}`;
        const fileResponse = await fetch(getFileUrl);
        
        if (!fileResponse.ok) {
          const errorText = await fileResponse.text();
          lastError = `Telegram getFile failed: ${fileResponse.status} ${fileResponse.statusText} - ${errorText.substring(0, 200)}`;
          console.warn(`[${correlationId}][${functionName}] ${lastError}`);
          continue; // Try again
        }
        
        const fileData = await fileResponse.json();
        
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
          lastError = `Telegram getFile returned invalid data: ${JSON.stringify(fileData).substring(0, 200)}`;
          console.warn(`[${correlationId}][${functionName}] ${lastError}`);
          continue; // Try again
        }
        
        filePath = fileData.result.file_path;
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[${correlationId}][${functionName}] getFile attempt ${attempt + 1} failed: ${lastError}`);
      }
    }
    
    if (!filePath) {
      return {
        success: false,
        error: lastError || 'Failed to get file path from Telegram',
        attempts
      };
    }
    
    // Download the file from Telegram
    lastError = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      attempts++;
      
      try {
        if (attempt > 0) {
          const delayMs = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
          console.log(`[${correlationId}][${functionName}] Retrying download (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const downloadUrl = `https://api.telegram.org/file/bot${this.telegramBotToken}/${filePath}`;
        const downloadResponse = await fetch(downloadUrl);
        
        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          lastError = `Telegram download failed: ${downloadResponse.status} ${downloadResponse.statusText} - ${errorText.substring(0, 200)}`;
          console.warn(`[${correlationId}][${functionName}] ${lastError}`);
          continue; // Try again
        }
        
        // Get the file as a blob
        const blob = await downloadResponse.blob();
        
        // Try to detect MIME type from response headers
        let detectedMimeType = downloadResponse.headers.get('content-type') || mimeType;
        
        // If content-type is octet-stream but we have a more specific type, use that
        if (detectedMimeType === 'application/octet-stream' && mimeType && mimeType !== 'application/octet-stream') {
          detectedMimeType = mimeType;
        }
        
        // Generate storage path
        const storagePath = this.generateStoragePath(fileUniqueId, detectedMimeType);
        
        return {
          success: true,
          blob,
          storagePath,
          mimeType: detectedMimeType,
          attempts
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[${correlationId}][${functionName}] Download attempt ${attempt + 1} failed: ${lastError}`);
      }
    }
    
    return {
      success: false,
      error: lastError || 'Failed to download file from Telegram',
      attempts
    };
  }
  
  /**
   * Upload media to storage with improved error handling
   * 
   * @param storagePath - Path where the file should be stored
   * @param fileData - The file data as a Blob
   * @param mimeType - MIME type of the file
   * @param correlationId - Request correlation ID for tracing
   * @returns Upload result object
   * @example
   * const result = await mediaProcessor.uploadMediaToStorage(
   *   'abc123.jpeg', blob, 'image/jpeg', 'corr-789'
   * );
   * if (result.success) {
   *   console.log(`Uploaded file: ${result.publicUrl}`);
   * } else {
   *   console.error(`Upload failed: ${result.error}`);
   * }
   */
  public async uploadMediaToStorage(
    storagePath: string,
    fileData: Blob,
    mimeType: string,
    correlationId: string
  ): Promise<UploadResult> {
    const functionName = 'uploadMediaToStorage';
    console.log(`[${correlationId}][${functionName}] Uploading to storage: ${storagePath}`);
    
    // Validate inputs
    if (!storagePath || !fileData) {
      return {
        success: false,
        error: !storagePath ? 'Missing storage path' : 'Missing file data'
      };
    }
    
    try {
      // Determine content disposition based on MIME type
      const contentDisposition = this.isViewableMimeType(mimeType) ? 'inline' : 'attachment';
      
      // Upload options
      const uploadOptions = {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: true,
        duplex: 'half',
        headers: {
          'Content-Disposition': `${contentDisposition}; filename="${storagePath}"`
        }
      };
      
      // Upload the file
      const { error: uploadError } = await this.supabaseClient.storage
        .from(this.storageBucket)
        .upload(storagePath, fileData, uploadOptions);
      
      if (uploadError) {
        console.error(`[${correlationId}][${functionName}] Upload error:`, uploadError.message);
        return {
          success: false,
          error: `Storage upload failed: ${uploadError.message}`
        };
      }
      
      // Get the public URL
      const { data: urlData } = this.supabaseClient.storage
        .from(this.storageBucket)
        .getPublicUrl(storagePath);
      
      if (!urlData || !urlData.publicUrl) {
        return {
          success: false,
          error: 'Failed to get public URL after upload'
        };
      }
      
      console.log(`[${correlationId}][${functionName}] Upload successful: ${urlData.publicUrl}`);
      return {
        success: true,
        publicUrl: urlData.publicUrl
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${correlationId}][${functionName}] Exception during upload:`, errorMessage);
      return {
        success: false,
        error: `Storage upload exception: ${errorMessage}`
      };
    }
  }
  
  /**
   * Check if a file already exists in storage by its unique ID
   * 
   * @param fileUniqueId - The unique file ID from Telegram
   * @param extension - The file extension
   * @param correlationId - Correlation ID for logging
   * @returns Object containing existence status and file path if exists
   * @example
   * const { exists, storagePath, publicUrl } = await mediaProcessor.checkFileExistsInStorage(
   *   'AgADBAADv6kxG-1fAUgQ8P4AAQNLrOVKiwAEgQ',
   *   'jpeg',
   *   correlationId
   * );
   */
  public async checkFileExistsInStorage(
    fileUniqueId: string,
    extension: string,
    correlationId: string
  ): Promise<{ exists: boolean; storagePath?: string; publicUrl?: string }> {
    const functionName = 'checkFileExistsInStorage';
    console.log(`[${correlationId}][${functionName}] Checking if file ${fileUniqueId}.${extension} exists in storage`);
    
    try {
      // First check if the file exists in the database
      const { data: existingMessage, error: dbError } = await this.supabaseClient
        .from('messages')
        .select('storage_path, public_url')
        .eq('file_unique_id', fileUniqueId)
        .maybeSingle();
      
      if (dbError) {
        console.error(`[${correlationId}][${functionName}] Error checking database for file_unique_id ${fileUniqueId}: ${dbError.message}`);
      }
      
      // If we found a record with this file_unique_id and it has a storage_path
      if (existingMessage && existingMessage.storage_path) {
        console.log(`[${correlationId}][${functionName}] Found existing file record in database with file_unique_id ${fileUniqueId}`);
        
        // Check if the file actually exists in storage
        const { data: storageData, error: storageError } = await this.supabaseClient
          .storage
          .from(this.storageBucket)
          .getPublicUrl(existingMessage.storage_path);
        
        if (!storageError) {
          // Verify the file exists by making a HEAD request
          try {
            const response = await fetch(storageData.publicUrl, { 
              method: 'HEAD',
              headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (response.ok) {
              console.log(`[${correlationId}][${functionName}] Verified file exists in storage at path ${existingMessage.storage_path}`);
              return { 
                exists: true, 
                storagePath: existingMessage.storage_path,
                publicUrl: existingMessage.public_url || storageData.publicUrl
              };
            }
          } catch (fetchError) {
            console.error(`[${correlationId}][${functionName}] Error verifying file existence: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          }
        }
      }
      
      // If we didn't find it in the database or couldn't verify it in storage, 
      // try the standardized path format
      const standardizedPath = this.getStandardizedPath(fileUniqueId, extension);
      
      try {
        const { data: storageData, error: storageError } = await this.supabaseClient
          .storage
          .from(this.storageBucket)
          .getPublicUrl(standardizedPath);
        
        if (!storageError) {
          // Verify the file exists by making a HEAD request
          const response = await fetch(storageData.publicUrl, { 
            method: 'HEAD',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            console.log(`[${correlationId}][${functionName}] Found file in storage at standardized path ${standardizedPath}`);
            return { 
              exists: true, 
              storagePath: standardizedPath,
              publicUrl: storageData.publicUrl
            };
          }
        }
      } catch (error) {
        console.error(`[${correlationId}][${functionName}] Error checking standardized path: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.log(`[${correlationId}][${functionName}] File with file_unique_id ${fileUniqueId} not found in storage`);
      return { exists: false };
    } catch (error) {
      console.error(`[${correlationId}][${functionName}] Exception checking file existence: ${error instanceof Error ? error.message : String(error)}`);
      return { exists: false };
    }
  }
  
  /**
   * Gets a standardized path for a file based on its file_unique_id and extension
   * 
   * @param fileUniqueId - The unique file identifier from Telegram
   * @param extension - The file extension
   * @returns The standardized storage path
   */
  getStandardizedPath(fileUniqueId: string, extension: string): string {
    // Ensure the extension doesn't have a leading dot
    const cleanExtension = extension.startsWith('.') ? extension.substring(1) : extension;
    return `${fileUniqueId}.${cleanExtension}`;
  }
  
  /**
   * Process media from a Telegram message
   * 
   * @param mediaContent - The media content to process
   * @param correlationId - Correlation ID for logging
   * @returns The processing result
   * @example
   * const result = await mediaProcessor.processMedia(mediaContent, correlationId);
   * if (result.success) {
   *   console.log(`Processed media: ${result.fileInfo.publicUrl}`);
   * }
   */
  public async processMedia(
    mediaContent: MediaContent,
    correlationId: string
  ): Promise<ProcessingResult> {
    const functionName = 'processMedia';
    console.log(`[${correlationId}][${functionName}] Processing media ${mediaContent.fileUniqueId}`);
    
    try {
      // Determine file extension from media type or MIME type
      let extension = 'bin';
      if (mediaContent.mimeType) {
        extension = this.getExtensionFromMimeType(mediaContent.mimeType);
      } else if (mediaContent.mediaType === 'photo') {
        extension = 'jpeg';
      }
      
      // Check if file already exists in storage by file_unique_id
      const existingFile = await this.checkFileExistsInStorage(
        mediaContent.fileUniqueId,
        extension,
        correlationId
      );
      
      // If file already exists, return the existing file info
      if (existingFile.exists && existingFile.publicUrl) {
        console.log(`[${correlationId}][${functionName}] Using existing file ${existingFile.storagePath}`);
        
        // Determine content disposition based on MIME type
        const contentDisposition = this.isViewableMimeType(mediaContent.mimeType || '')
          ? 'inline'
          : 'attachment';
        
        return {
          status: 'success',
          fileId: mediaContent.fileId,
          fileUniqueId: mediaContent.fileUniqueId,
          storagePath: existingFile.storagePath,
          publicUrl: existingFile.publicUrl,
          mimeType: mediaContent.mimeType || this.getMimeTypeFromExtension(extension),
          extension: extension,
          error: undefined
        };
      }
      
      // File doesn't exist, proceed with download and upload
      console.log(`[${correlationId}][${functionName}] File doesn't exist, downloading from Telegram`);
      
      // Download file from Telegram
      const downloadResult = await this.downloadMediaFromTelegram(
        mediaContent.fileId,
        mediaContent.fileUniqueId,
        extension,
        correlationId
      );
      
      if (!downloadResult.success || !downloadResult.blob) {
        if (downloadResult.error && downloadResult.error.includes('file reference expired') || downloadResult.error.includes('File_id doesn\'t match')) {
          return {
            status: 'download_failed_forwarded',
            fileId: mediaContent.fileId,
            fileUniqueId: mediaContent.fileUniqueId,
            storagePath: null,
            publicUrl: null,
            mimeType: mediaContent.mimeType,
            extension: extension,
            error: 'Cannot download forwarded media due to inaccessible file_id.'
          };
        } else {
          return {
            status: 'error',
            fileId: mediaContent.fileId,
            fileUniqueId: mediaContent.fileUniqueId,
            storagePath: null,
            publicUrl: null,
            mimeType: mediaContent.mimeType,
            extension: extension,
            error: downloadResult.error || 'Failed to download media'
          };
        }
      }
      
      // Upload file to storage
      const uploadResult = await this.uploadMediaToStorage(
        downloadResult.blob,
        downloadResult.storagePath!,
        downloadResult.mimeType!,
        correlationId
      );
      
      if (!uploadResult.success) {
        return {
          status: 'error',
          fileId: mediaContent.fileId,
          fileUniqueId: mediaContent.fileUniqueId,
          storagePath: downloadResult.storagePath,
          publicUrl: null,
          mimeType: downloadResult.mimeType,
          extension: extension,
          error: uploadResult.error || 'Failed to upload media'
        };
      }
      
      // Determine content disposition based on MIME type
      const contentDisposition = this.isViewableMimeType(downloadResult.mimeType || '')
        ? 'inline'
        : 'attachment';
      
      return {
        status: 'success',
        fileId: mediaContent.fileId,
        fileUniqueId: mediaContent.fileUniqueId,
        storagePath: downloadResult.storagePath,
        publicUrl: uploadResult.publicUrl,
        mimeType: downloadResult.mimeType,
        extension: extension,
        error: undefined
      };
    } catch (error) {
      console.error(`[${correlationId}][${functionName}] Exception processing media:`, error);
      return {
        status: 'error',
        fileId: mediaContent.fileId,
        fileUniqueId: mediaContent.fileUniqueId,
        storagePath: null,
        publicUrl: null,
        mimeType: mediaContent.mimeType,
        extension: extension,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Create a MediaProcessor instance with the provided dependencies
   * 
   * @param supabaseClient - Initialized Supabase client
   * @param telegramBotToken - Telegram Bot API token
   * @param storageBucket - Name of the storage bucket (default: 'telegram-media')
   * @returns A new MediaProcessor instance
   * @example
   * const mediaProcessor = createMediaProcessor(
   *   supabaseClient,
   *   Deno.env.get('TELEGRAM_BOT_TOKEN')
   * );
   */
  public static createMediaProcessor(
    supabaseClient: SupabaseClient,
    telegramBotToken: string,
    storageBucket: string = 'telegram-media'
  ): MediaProcessor {
    return new MediaProcessor(supabaseClient, telegramBotToken, storageBucket);
  }
}

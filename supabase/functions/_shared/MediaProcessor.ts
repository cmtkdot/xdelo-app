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
  /** Content disposition for browser handling */
  contentDisposition?: 'inline' | 'attachment';
  /** Error message if processing failed */
  error?: string;
}

/**
 * MediaProcessor class for handling Telegram media
 * 
 * This class provides a comprehensive set of methods for processing media files from Telegram messages.
 * It handles downloading media from Telegram, uploading to Supabase Storage, and managing file metadata.
 */
export class MediaProcessor {
  private supabaseClient: SupabaseClient;
  private telegramBotToken: string;
  private storageBucket: string;
  
  /**
   * Create a new MediaProcessor instance
   * 
   * @param supabaseClient - Initialized Supabase client for database and storage operations
   * @param telegramBotToken - Telegram Bot API token for authenticating download requests
   * @param storageBucket - Name of the storage bucket where media files will be stored (default: 'telegram-media')
   * @example
   * ```typescript
   * // Create a new MediaProcessor instance
   * const mediaProcessor = new MediaProcessor(
   *   supabaseClient,
   *   Deno.env.get('TELEGRAM_BOT_TOKEN')!,
   *   'telegram-media'
   * );
   * ```
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
   * This method analyzes a Telegram message object and extracts media content information
   * (photo, video, document) if present. It handles different media types and extracts
   * relevant metadata like dimensions, file size, and MIME type.
   * 
   * @param message - The Telegram message object to extract media content from
   * @returns The media content object if media is found, undefined otherwise
   * @example
   * ```typescript
   * // Extract media content from a Telegram message
   * const mediaContent = mediaProcessor.extractMediaContent(message);
   * 
   * if (mediaContent) {
   *   console.log(`Found ${mediaContent.mediaType} with ID ${mediaContent.fileId}`);
   *   console.log(`File unique ID: ${mediaContent.fileUniqueId}`);
   *   
   *   // Access media-specific properties
   *   if (mediaContent.mediaType === 'photo' || mediaContent.mediaType === 'video') {
   *     console.log(`Dimensions: ${mediaContent.width}x${mediaContent.height}`);
   *   }
   *   
   *   if (mediaContent.mediaType === 'video') {
   *     console.log(`Duration: ${mediaContent.duration} seconds`);
   *   }
   * } else {
   *   console.log('No media content found in message');
   * }
   * ```
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
   * This method checks if a given MIME type corresponds to a file that can be
   * displayed inline in a browser (images, videos, PDFs, etc.) rather than
   * requiring download. Used to set the Content-Disposition header appropriately.
   * 
   * @param mimeType - MIME type of the file to check
   * @returns Boolean indicating if the file should be viewable in browser
   * @example
   * ```typescript
   * // Determine if a file should be displayed inline or downloaded
   * const mimeType = 'image/jpeg';
   * const contentDisposition = mediaProcessor.isViewableMimeType(mimeType)
   *   ? 'inline'
   *   : 'attachment';
   * 
   * console.log(`Content-Disposition for ${mimeType}: ${contentDisposition}`);
   * // Output: "Content-Disposition for image/jpeg: inline"
   * ```
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
   * This method takes a MIME type and returns the corresponding file extension.
   * It uses a predefined mapping to handle common MIME types and their extensions.
   * 
   * @param mimeType - MIME type of the file
   * @returns The file extension (without leading dot)
   * @example
   * ```typescript
   * // Get the file extension for a MIME type
   * const mimeType = 'image/jpeg';
   * const extension = mediaProcessor.getExtensionFromMimeType(mimeType);
   * console.log(`Extension for ${mimeType}: ${extension}`);
   * // Output: "Extension for image/jpeg: jpeg"
   * ```
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
   * Infer MIME type from media type when not provided by Telegram
   * 
   * This method takes a media type and infers a reasonable MIME type
   * when the actual MIME type is not available from Telegram.
   * 
   * @param mediaType - The type of media (photo, video, document)
   * @returns The inferred MIME type
   */
  private inferMimeTypeFromMediaType(mediaType: string): string {
    const mediaTypeToMimeMap: Record<string, string> = {
      'photo': 'image/jpeg',
      'video': 'video/mp4',
      'document': 'application/pdf',  // Default documents to PDF rather than octet-stream
      'audio': 'audio/mpeg',
      'voice': 'audio/ogg',
      'animation': 'video/mp4',
      'sticker': 'image/webp',
      'video_note': 'video/mp4'
    };
    
    // Only return octet-stream as an absolute last resort
    return mediaTypeToMimeMap[mediaType] || 'application/pdf';
  }
  
  /**
   * Detect and standardize MIME type from Telegram data
   * 
   * This method takes a Telegram message object and attempts to detect the MIME type
   * of the media content. It uses various methods to infer the MIME type, including
   * checking the file extension, MIME type from the message, and defaulting to a
   * generic type if all else fails.
   * 
   * @param message - The Telegram message object to detect MIME type from
   * @returns The detected MIME type
   * @example
   * ```typescript
   * // Detect MIME type from a Telegram message
   * const mimeType = mediaProcessor.detectMimeType(message);
   * console.log(`Detected MIME type: ${mimeType}`);
   * ```
   */
  public detectMimeType(message: TelegramMessage): string | null {
    // Try to get MIME type from the message
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const document = message.document;
    const video = message.video;
    const audio = message.audio;
    const voice = message.voice;
    const animation = message.animation;
    const sticker = message.sticker;
    
    // Get MIME type from appropriate media object
    let mimeType = null;
    
    if (document && document.mime_type) {
      mimeType = document.mime_type;
      
      // Special handling for files with file_name - use extension to improve MIME type accuracy
      if (document.file_name && (mimeType === 'application/octet-stream' || mimeType === 'application/zip')) {
        const fileExtension = document.file_name.split('.').pop()?.toLowerCase();
        if (fileExtension) {
          const extensionMimeMap: Record<string, string> = {
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
   * This method creates a consistent storage path for a file based on its unique ID and MIME type.
   * The path follows the format: `{fileUniqueId}.{extension}` where the extension is derived
   * from the MIME type. This ensures files are stored with consistent naming conventions.
   * 
   * @param fileUniqueId - Unique identifier for the file from Telegram
   * @param mimeType - MIME type of the file used to determine the extension
   * @returns The standardized storage path for the file
   * @example
   * ```typescript
   * // Generate a storage path for a file
   * const fileUniqueId = 'AgADcAUAAj-vwFc';
   * const mimeType = 'image/jpeg';
   * const storagePath = mediaProcessor.generateStoragePath(fileUniqueId, mimeType);
   * console.log(`Storage path: ${storagePath}`);
   * // Output: "Storage path: AgADcAUAAj-vwFc.jpeg"
   * ```
   */
  public generateStoragePath(fileUniqueId: string, mimeType: string): string {
    const extension = this.getExtensionFromMimeType(mimeType);
    return `${fileUniqueId}.${extension}`;
  }
  
  /**
   * Check if a file already exists in the database
   * 
   * This method checks if a file with the given unique ID exists in the database.
   * It returns an object with a boolean indicating existence and the message data if found.
   * 
   * @param fileUniqueId - Unique identifier for the file
   * @returns Object with exists flag and message data if found
   * @example
   * ```typescript
   * // Check if a file exists in the database
   * const { exists, message } = await mediaProcessor.findExistingFile('AgADcAUAAj-vwFc');
   * if (exists) {
   *   console.log(`File already exists with ID: ${message.id}`);
   * }
   * ```
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
   * This method checks if a file with the given storage path exists in storage.
   * It returns a boolean indicating existence.
   * 
   * @param storagePath - Path to the file in storage
   * @returns Boolean indicating if the file exists
   * @example
   * ```typescript
   * // Check if a file exists in storage
   * const exists = await mediaProcessor.verifyFileExists('AgADcAUAAj-vwFc.jpeg');
   * console.log(`File ${exists ? 'exists' : 'does not exist'} in storage`);
   * ```
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
   * This method downloads media from Telegram using the provided file ID and unique ID.
   * It returns a download result object with success status, blob data, and error message.
   * 
   * @param fileId - Telegram file ID
   * @param fileUniqueId - Unique identifier for the file
   * @param mimeType - MIME type of the file
   * @param correlationId - Request correlation ID for tracing
   * @returns Download result object
   * @example
   * ```typescript
   * // Download media from Telegram
   * const result = await mediaProcessor.downloadMediaFromTelegram(
   *   'AgADcAUAAj-vwFc', 'AgADcAUAAj-vwFc', 'image/jpeg', 'corr-789'
   * );
   * if (result.success) {
   *   console.log(`Downloaded file: ${result.storagePath}`);
   * } else {
   *   console.error(`Download failed: ${result.error}`);
   * }
   * ```
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
   * This method uploads media to storage using the provided file data and storage path.
   * It returns an upload result object with success status, public URL, and error message.
   * 
   * @param storagePath - Path where the file should be stored
   * @param fileData - The file data as a Blob
   * @param mimeType - MIME type of the file
   * @param correlationId - Request correlation ID for tracing
   * @returns Upload result object
   * @example
   * ```typescript
   * // Upload media to storage
   * const result = await mediaProcessor.uploadMediaToStorage(
   *   'AgADcAUAAj-vwFc.jpeg', blob, 'image/jpeg', 'corr-789'
   * );
   * if (result.success) {
   *   console.log(`Uploaded file: ${result.publicUrl}`);
   * } else {
   *   console.error(`Upload failed: ${result.error}`);
   * }
   * ```
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
   * This method checks if a file with the given unique ID exists in storage.
   * It returns an object with existence status, storage path, and public URL if found.
   * 
   * @param fileUniqueId - The unique file ID from Telegram
   * @param extension - The file extension
   * @param correlationId - Correlation ID for logging
   * @returns Object containing existence status and file path if exists
   * @example
   * ```typescript
   * // Check if a file exists in storage
   * const { exists, storagePath, publicUrl } = await mediaProcessor.checkFileExistsInStorage(
   *   'AgADcAUAAj-vwFc', 'jpeg', 'corr-789'
   * );
   * if (exists) {
   *   console.log(`File exists in storage: ${storagePath}`);
   * }
   * ```
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
   * This method creates a consistent storage path format for a file using its unique ID
   * and extension. It ensures that all file paths follow the same convention throughout
   * the application, making it easier to locate and manage files.
   * 
   * @param fileUniqueId - The unique file identifier from Telegram
   * @param extension - The file extension (without leading dot)
   * @returns The standardized storage path in the format `{fileUniqueId}.{extension}`
   * @example
   * ```typescript
   * // Get a standardized path for a file
   * const fileUniqueId = 'AgADcAUAAj-vwFc';
   * const extension = 'jpeg';
   * const path = mediaProcessor.getStandardizedPath(fileUniqueId, extension);
   * console.log(`Standardized path: ${path}`);
   * // Output: "Standardized path: AgADcAUAAj-vwFc.jpeg"
   * ```
   */
  private getStandardizedPath(fileUniqueId: string, extension: string): string {
    // Ensure the extension doesn't have a leading dot
    const cleanExtension = extension.startsWith('.') ? extension.substring(1) : extension;
    return `${fileUniqueId}.${cleanExtension}`;
  }
  
  /**
   * Process media from a Telegram message
   * 
   * This method processes media from a Telegram message by downloading it from Telegram,
   * uploading it to storage, and updating the database with the file metadata.
   * 
   * @param mediaContent - The media content to process
   * @param correlationId - Correlation ID for logging
   * @returns The processing result
   * @example
   * ```typescript
   * // Process media from a Telegram message
   * const result = await mediaProcessor.processMedia(mediaContent, correlationId);
   * if (result.success) {
   *   console.log(`Processed media: ${result.fileInfo.publicUrl}`);
   * }
   * ```
   */
  /**
   * Process media from Telegram and store it in Supabase storage
   *
   * This method extracts media content from Telegram, processes it,
   * and stores it in Supabase storage. It handles duplicate detection,
   * downloading, and uploading, while ensuring proper MIME type detection.
   *
   * @param mediaContent - Media content extracted from Telegram message
   * @param correlationId - Request correlation ID for tracing
   * @returns Processing result object with file details
   */
  public async processMedia(
    mediaContent: MediaContent,
    correlationId: string
  ): Promise<ProcessingResult> {
    const functionName = 'processMedia';
    console.log(`[${correlationId}][${functionName}] Processing media ${mediaContent.fileUniqueId}`);
    
    try {
      // Detect proper MIME type from Telegram data
      let detectedMimeType = mediaContent.mimeType || this.inferMimeTypeFromMediaType(mediaContent.mediaType);
      
      // Determine file extension from media type or MIME type
      let extension = this.getExtensionFromMimeType(detectedMimeType);
      
      // Fallback for photos without MIME type
      if (extension === 'bin' && mediaContent.mediaType === 'photo') {
        extension = 'jpeg';
        detectedMimeType = 'image/jpeg';
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
        const contentDisposition = this.isViewableMimeType(detectedMimeType)
          ? 'inline'
          : 'attachment';
        
        console.log(`[${correlationId}][${functionName}] File MIME type: ${detectedMimeType}, Content-Disposition: ${contentDisposition}`);
        
        return {
          status: 'success',
          fileId: mediaContent.fileId,
          fileUniqueId: mediaContent.fileUniqueId,
          storagePath: existingFile.storagePath,
          publicUrl: existingFile.publicUrl,
          mimeType: detectedMimeType,  // Use the properly detected MIME type
          extension: extension,
          contentDisposition: contentDisposition,  // Add content disposition to the result
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
        downloadResult.storagePath!,
        downloadResult.blob,
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
      
      console.log(`[${correlationId}][${functionName}] File MIME type: ${downloadResult.mimeType}, Content-Disposition: ${contentDisposition}`);
      
      return {
        status: 'success',
        fileId: mediaContent.fileId,
        fileUniqueId: mediaContent.fileUniqueId,
        storagePath: downloadResult.storagePath,
        publicUrl: uploadResult.publicUrl,
        mimeType: downloadResult.mimeType,
        extension: extension,
        contentDisposition: contentDisposition,  // Add content disposition to the result
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
   * ```typescript
   * // Create a new MediaProcessor instance
   * const mediaProcessor = createMediaProcessor(
   *   supabaseClient,
   *   Deno.env.get('TELEGRAM_BOT_TOKEN')
   * );
   * ```
   */
  public static createMediaProcessor(
    supabaseClient: SupabaseClient,
    telegramBotToken: string,
    storageBucket: string = 'telegram-media'
  ): MediaProcessor {
    return new MediaProcessor(supabaseClient, telegramBotToken, storageBucket);
  }
}

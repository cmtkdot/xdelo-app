import { SupabaseClient } from './supabaseClient.ts';
import { corsHeaders } from './cors.ts';
import { TelegramMessage } from '../telegram-webhook/types.ts';

/**
 * Options for the retry operation
 */
interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelayMs: number;
  /** Factor by which to increase delay on each retry */
  backoffFactor: number;
  /** Function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Result of a retry operation
 */
interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result of the operation if successful */
  result?: T;
  /** Error message if the operation failed */
  error?: string;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent on retry attempts in milliseconds */
  totalTimeMs: number;
}

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
/**
 * Utility function to retry an asynchronous operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @param correlationId - Correlation ID for logging
 * @param operationName - Name of the operation for logging
 * @returns Result of the retry operation
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  correlationId: string,
  operationName: string
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;
  let delay = options.initialDelayMs;
  let lastError: unknown;
  
  const defaultIsRetryable = () => true;
  const isRetryable = options.isRetryable || defaultIsRetryable;
  
  while (attempts < options.maxAttempts) {
    attempts++;
    
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts,
        totalTimeMs: Date.now() - startTime
      };
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[${correlationId}][${operationName}] Attempt ${attempts} failed: ${errorMessage}`);
      
      if (attempts >= options.maxAttempts || !isRetryable(error)) {
        break;
      }
      
      // Wait before the next attempt with exponential backoff
      console.log(`[${correlationId}][${operationName}] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= options.backoffFactor;
    }
  }
  
  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    attempts,
    totalTimeMs: Date.now() - startTime
  };
}

/**
 * MediaProcessor class for handling Telegram media
 * 
 * This class provides a comprehensive set of methods for processing media files from Telegram messages.
 * It handles downloading media from Telegram, uploading to Supabase Storage, and managing file metadata.
 */
export class MediaProcessor {
  // Core dependencies
  private readonly supabaseClient: SupabaseClient;
  private readonly telegramBotToken: string;
  private readonly storageBucket: string;
  
  // Cache mapping objects for better performance
  private readonly mimeToExtensionMap: Record<string, string>;
  private readonly extensionToMimeMap: Record<string, string>;
  
  // Common retry configurations
  private readonly defaultDownloadRetryOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffFactor: 2
  };
  
  private readonly defaultUploadRetryOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffFactor: 2
  };
  
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
    
    // Initialize MIME type to extension mapping cache for better performance
    this.mimeToExtensionMap = {
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/tiff': 'tiff',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/mpeg': 'mpeg',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/x-matroska': 'mkv',
      'video/x-ms-wmv': 'wmv',
      'video/x-flv': 'flv',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'weba',
      'audio/midi': 'midi',
      'audio/x-ms-wma': 'wma',
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
      'application/gzip': 'gz',
      'application/x-tar': 'tar',
      'application/x-bzip2': 'bz2',
      'application/json': 'json',
      'application/xml': 'xml',
      'application/javascript': 'js',
      'application/octet-stream': 'bin',
      'text/plain': 'txt',
      'text/html': 'html',
      'text/css': 'css',
      'text/csv': 'csv',
      'text/markdown': 'md',
      'font/ttf': 'ttf',
      'font/woff': 'woff',
      'font/woff2': 'woff2',
      'font/otf': 'otf'
    };
    
    // Initialize extension to MIME type mapping cache
    this.extensionToMimeMap = {};
    for (const [mime, ext] of Object.entries(this.mimeToExtensionMap)) {
      this.extensionToMimeMap[ext] = mime;
    }
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
    if (!mimeType) return 'bin';
    
    // Common MIME type patterns
    if (mimeType.startsWith('image/jpeg') || mimeType === 'image/jpg') return 'jpeg';
    if (mimeType.startsWith('image/')) return mimeType.substring(6);
    if (mimeType.startsWith('video/')) {
      const subtype = mimeType.substring(6);
      if (subtype === 'quicktime') return 'mov';
      if (subtype === 'x-msvideo') return 'avi';
      if (subtype === 'x-matroska') return 'mkv';
      if (subtype === 'ogg') return 'ogv';
      return subtype;
    }
    if (mimeType.startsWith('audio/')) {
      const subtype = mimeType.substring(6);
      if (subtype === 'webm') return 'weba';
      return subtype;
    }
    
    // Full mapping for special cases
    const mimeToExtensionMap: Record<string, string> = {
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
    
    return mimeToExtensionMap[mimeType] || 'bin';
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
    if (!mediaType) return 'application/pdf';
    
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
   * Get MIME type from file extension
   * 
   * This method maps a file extension to its corresponding MIME type
   * using a comprehensive mapping table.
   * 
   * @param extension - File extension (without leading dot)
   * @returns The corresponding MIME type or null if not found
   * @private
   */
  private getMimeTypeFromExtension(extension: string): string | null {
    if (!extension) return null;
    
    const extensionToMimeMap: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'avif': 'image/avif',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      
      // Videos
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'ogv': 'video/ogg',
      'mpg': 'video/mpeg',
      
      // Audio
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'weba': 'audio/webm',
      'wav': 'audio/wav',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      'bz2': 'application/x-bzip2',
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'xml': 'application/xml'
    };
    
    return extensionToMimeMap[extension.toLowerCase()] || null;
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
  public detectMimeType(message: TelegramMessage): string {
    // Try to get MIME type from the message
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const document = message.document;
    const video = message.video;
    const audio = message.audio;
    const voice = message.voice;
    const animation = message.animation;
    const sticker = message.sticker;
    
    // Get MIME type from appropriate media object
    let mimeType: string | null = null;
    
    // First try to get explicit MIME type from Telegram objects
    if (document && document.mime_type) {
      mimeType = document.mime_type;
      
      // Special handling for files with file_name when MIME type is generic
      if (document.file_name && (mimeType === 'application/octet-stream' || mimeType === 'application/zip')) {
        const fileExtension = document.file_name.split('.').pop()?.toLowerCase();
        if (fileExtension) {
          const extensionMimeType = this.getMimeTypeFromExtension(fileExtension);
          if (extensionMimeType) {
            return extensionMimeType;
          }
        }
      }
    } else if (video && video.mime_type) {
      mimeType = video.mime_type;
    } else if (audio && audio.mime_type) {
      mimeType = audio.mime_type;
    } else if (voice && voice.mime_type) {
      mimeType = voice.mime_type;
    } else if (animation && animation.mime_type) {
      mimeType = animation.mime_type;
    } else if (sticker && sticker.mime_type) {
      mimeType = sticker.mime_type;
    } else if (photo) {
      // Photos typically don't include mime_type in Telegram API response
      mimeType = 'image/jpeg';
    }
    
    // If we still don't have a MIME type, infer based on media type
    if (!mimeType) {
      // Try to get from media type
      if (photo) {
        mimeType = 'image/jpeg';
      } else if (video) {
        mimeType = 'video/mp4';
      } else if (audio) {
        mimeType = 'audio/mpeg';
      } else if (voice) {
        mimeType = 'audio/ogg';
      } else if (animation) {
        mimeType = 'video/mp4';
      } else if (sticker) {
        mimeType = 'image/webp';
      } else if (document) {
        // Try to infer from filename if available
        if (document.file_name) {
          const fileExtension = document.file_name.split('.').pop()?.toLowerCase();
          if (fileExtension) {
            const extensionMimeType = this.getMimeTypeFromExtension(fileExtension);
            if (extensionMimeType) {
              return extensionMimeType;
            }
          }
        }
        
        // Default document type to PDF instead of octet-stream if we can't determine
        mimeType = 'application/pdf';
      }
    }
    
    // Default fallback - only use octet-stream as a last resort
    return mimeType || 'application/octet-stream';
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
    return this.getStandardizedPath(fileUniqueId, extension);
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
      const { data } = await this.supabaseClient.storage
        .from(this.storageBucket)
        .createSignedUrl(storagePath, 60);
      
      // If we can create a signed URL, the file exists
      return !!data;
    } catch (error) {
      // File does not exist or there was an error creating the signed URL
      return false;
    }
  }
  
  /**
   * Download media from Telegram with improved error handling
   * 
   * This method downloads media from Telegram using the provided file ID and unique ID.
   * It uses the retry utility with exponential backoff for better error handling and reliability.
   * 
   * @param fileId - Telegram file ID
   * @param fileUniqueId - Unique identifier for the file
   * @param extension - The file extension to use
   * @param correlationId - Correlation ID for logging
   * @returns Download result object with status and file data
   */
  private async downloadMediaFromTelegram(
    fileId: string,
    fileUniqueId: string,
    extension: string,
    correlationId: string
  ): Promise<DownloadResult> {
    const functionName = 'downloadMediaFromTelegram';
    console.log(`[${correlationId}][${functionName}] Downloading file ${fileId} from Telegram`);
    
    // Create standardized storage path using our utility method
    const storagePath = this.getStandardizedPath(fileUniqueId, extension);
    
    try {
      // Define retry options for getFile operation
      const getFileOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffFactor: 2,
        isRetryable: (error) => {
          const errorStr = String(error);
          // Don't retry if file reference is expired - this is a permanent error
          return !errorStr.includes('file reference expired') && 
                 !errorStr.includes("File_id doesn't match");
        }
      };
      
      // Get file metadata from Telegram with retries
      const getFileUrl = `https://api.telegram.org/bot${this.telegramBotToken}/getFile`;
      const getFileParams = new URLSearchParams({ file_id: fileId });
      
      const getFileResult = await retryOperation(async () => {
        const response = await fetch(`${getFileUrl}?${getFileParams.toString()}`);
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to get file info: ${response.status} ${response.statusText}\nBody: ${errorBody}`);
        }
        
        const fileData = await response.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
          throw new Error(`Invalid getFile response: ${JSON.stringify(fileData)}`);
        }
        
        return fileData;
      }, getFileOptions, correlationId, functionName + '.getFile');
      
      if (!getFileResult.success || !getFileResult.result) {
        const errorMsg = getFileResult.error || 'Failed to get file metadata';
        // Check if this is a forwarded message with an expired file reference
        if (errorMsg.includes('file reference expired') || errorMsg.includes("File_id doesn't match")) {
          return { 
            success: false, 
            error: 'File reference expired or file ID no longer valid',
            attempts: getFileResult.attempts,
            storagePath
          };
        }
        
        return { 
          success: false, 
          error: errorMsg,
          attempts: getFileResult.attempts,
          storagePath
        };
      }
      
      // Telegram returned file info, now download the actual file
      const fileData = getFileResult.result;
      const filePath = fileData.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${this.telegramBotToken}/${filePath}`;
      
      // Define retry options for download operation
      const downloadOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffFactor: 2
      };
      
      const downloadResult = await retryOperation(async () => {
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        
        return response.blob();
      }, downloadOptions, correlationId, functionName + '.download');
      
      if (!downloadResult.success || !downloadResult.result) {
        return { 
          success: false, 
          error: downloadResult.error || 'Failed to download file',
          attempts: getFileResult.attempts + downloadResult.attempts,
          storagePath
        };
      }
      
      const blob = downloadResult.result;
      
      // For photos without explicit MIME type, ensure proper image MIME type
      let mimeType = blob.type || 'application/octet-stream';
      if (mimeType === 'application/octet-stream') {
        // Check if extension corresponds to known image types
        const lowerExt = extension.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lowerExt)) {
          // Use extension to MIME type map from cache
          mimeType = this.extensionToMimeMap[lowerExt] || `image/${lowerExt}`;
        }
      }
      
      console.log(`[${correlationId}][${functionName}] Successfully downloaded file ${fileId} (${blob.size} bytes, MIME: ${mimeType})`);
      
      return {
        success: true,
        blob,
        storagePath,
        mimeType,
        attempts: getFileResult.attempts + downloadResult.attempts
      };
    } catch (error) {
      console.error(`[${correlationId}][${functionName}] Error downloading media from Telegram: ${error instanceof Error ? error.message : String(error)}`);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error), 
        attempts: 1,
        storagePath 
      };
    }
  }
  
  /**
   * Upload media to storage with improved error handling and retry logic
   * 
   * This method uploads media to storage using the provided file data and storage path.
   * It leverages the retry utility for better reliability and error handling.
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
      
      // Define retry options for upload operation
      const uploadRetryOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffFactor: 2,
        isRetryable: (error) => {
          const errorStr = String(error);
          // Only retry on connection or temporary errors, not permission issues
          return !errorStr.includes('permission denied') && 
                 !errorStr.includes('already exists') &&
                 !errorStr.includes('invalid content type');
        }
      };
      
      // Upload the file with retry
      const uploadResult = await retryOperation(async () => {
        const { data, error } = await this.supabaseClient.storage
          .from(this.storageBucket)
          .upload(storagePath, fileData, uploadOptions);
          
        if (error) {
          // Transform into throwable error for retry mechanism
          throw new Error(`Storage upload failed: ${error.message}`);
        }
        
        return data;
      }, uploadRetryOptions, correlationId, functionName + '.upload');
      
      if (!uploadResult.success) {
        console.error(`[${correlationId}][${functionName}] Upload failed after ${uploadResult.attempts} attempts: ${uploadResult.error}`);
        return {
          success: false,
          error: uploadResult.error || 'Upload failed after multiple attempts'
        };
      }
      
      // Get the public URL - this rarely fails so doesn't need retry
      const { data: urlData } = this.supabaseClient.storage
        .from(this.storageBucket)
        .getPublicUrl(storagePath);
      
      if (!urlData || !urlData.publicUrl) {
        return {
          success: false,
          error: 'Failed to get public URL after successful upload'
        };
      }
      
      console.log(`[${correlationId}][${functionName}] Upload successful after ${uploadResult.attempts} attempt(s): ${urlData.publicUrl}`);
      return {
        success: true,
        publicUrl: urlData.publicUrl
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${correlationId}][${functionName}] Unexpected exception during upload:`, errorMessage);
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
      // Check if the file exists in the database
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
      
      // Simple fallback: try with the direct fileUniqueId.extension format
      const simplePath = `${fileUniqueId}.${extension}`;
      try {
        const { data: storageData, error: storageError } = await this.supabaseClient
          .storage
          .from(this.storageBucket)
          .getPublicUrl(simplePath);
        
        if (!storageError) {
          // Verify the file exists by making a HEAD request
          const response = await fetch(storageData.publicUrl, { 
            method: 'HEAD',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            console.log(`[${correlationId}][${functionName}] Found file in storage at simple path ${simplePath}`);
            return { 
              exists: true, 
              storagePath: simplePath,
              publicUrl: storageData.publicUrl
            };
          }
        }
      } catch (error) {
        console.error(`[${correlationId}][${functionName}] Error checking simple path: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Try one more fallback with .bin extension which seems to be used in your system
      const binPath = `${fileUniqueId}.bin`;
      try {
        const { data: storageData, error: storageError } = await this.supabaseClient
          .storage
          .from(this.storageBucket)
          .getPublicUrl(binPath);
        
        if (!storageError) {
          // Verify the file exists by making a HEAD request
          const response = await fetch(storageData.publicUrl, { 
            method: 'HEAD',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            console.log(`[${correlationId}][${functionName}] Found file in storage at bin path ${binPath}`);
            return { 
              exists: true, 
              storagePath: binPath,
              publicUrl: storageData.publicUrl
            };
          }
        }
      } catch (error) {
        console.error(`[${correlationId}][${functionName}] Error checking bin path: ${error instanceof Error ? error.message : String(error)}`);
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
   * console.log(path); // Output: "AgADcAUAAj-vwFc.jpeg"
   * ```
   */
  public getStandardizedPath(fileUniqueId: string, extension: string): string {
    // Ensure extension doesn't have a leading dot
    const cleanExtension = extension.startsWith('.') ? extension.substring(1) : extension;
    
    // Create a standardized path in the format fileUniqueId.extension
    return `${fileUniqueId}.${cleanExtension}`;
  }
   * This method extracts media content from Telegram, processes it,
   * and stores it in Supabase storage. It handles duplicate detection,
   * downloading, and uploading, while ensuring proper MIME type detection.
   *
   * @param mediaContent - Media content extracted from Telegram message
   * @param correlationId - Request correlation ID for tracing
   * @returns Processing result object with file details
   * @example
   * ```typescript
   * // Process media from a Telegram message
   * const result = await mediaProcessor.processMedia(mediaContent, correlationId);
   * if (result.status === 'success') {
   *   console.log(`Processed media: ${result.publicUrl}`);
   * }
   * ```
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

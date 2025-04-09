import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "./cors.ts";
import { MediaProcessor } from './MediaProcessor.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

/**
 * @deprecated Use MediaProcessor.isViewableMimeType instead.
 * This function will be removed in a future release.
 */
// Determine if a file should be viewable in browser based on its MIME type
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  console.warn('xdelo_isViewableMimeType is deprecated. Use MediaProcessor.isViewableMimeType instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.isViewableMimeType(mimeType);
}

/**
 * @deprecated Use MediaProcessor.getExtensionFromMimeType instead.
 * This function will be removed in a future release.
 */
// Get file extension from MIME type with improved mapping
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  console.warn('xdelo_getExtensionFromMimeType is deprecated. Use MediaProcessor.getExtensionFromMimeType instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.getExtensionFromMimeType(mimeType);
}

/**
 * @deprecated Use MediaProcessor.detectMimeType instead.
 * This function will be removed in a future release.
 */
// Improved function to detect and standardize MIME type from Telegram data
export function xdelo_detectMimeType(telegramData: any): string {
  console.warn('xdelo_detectMimeType is deprecated. Use MediaProcessor.detectMimeType instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.detectMimeType(telegramData);
}

/**
 * @deprecated Use MediaProcessor.generateStoragePath instead.
 * This function will be removed in a future release.
 */
// Standardize storage path generation
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  console.warn('xdelo_generateStoragePath is deprecated. Use MediaProcessor.generateStoragePath instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.generateStoragePath(fileUniqueId, mimeType);
}

/**
 * @deprecated Use MediaProcessor.generateStoragePath (or review logic) instead. This function's purpose might be covered by generateStoragePath.
 * This function will be removed in a future release.
 */
// Validate and fix a storage path if needed
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  console.warn('xdelo_validateAndFixStoragePath is deprecated. Use MediaProcessor.generateStoragePath (or review logic) instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.generateStoragePath(fileUniqueId, mimeType);
}

/**
 * @deprecated Upload options are handled internally within MediaProcessor.uploadMediaToStorage.
 * This function will be removed in a future release.
 */
// Get upload options with proper content disposition
export function xdelo_getUploadOptions(mimeType: string): Record<string, any> {
  console.warn('xdelo_getUploadOptions is deprecated. Upload options are handled internally within MediaProcessor.uploadMediaToStorage.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.getUploadOptions(mimeType);
}

/**
 * @deprecated Use MediaProcessor.fetchWithRetry instead.
 * This function will be removed in a future release.
 */
/**
 * Enhanced fetch function with exponential backoff retry logic and improved error handling
 * @param url The URL to fetch
 * @param options Fetch options
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelay Initial delay between retries in ms
 * @returns The fetch response
 */
async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 5,
  initialRetryDelay: number = 500
): Promise<Response> {
  console.warn('xdelo_fetchWithRetry is deprecated. Use MediaProcessor.fetchWithRetry instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, Deno.env.get("TELEGRAM_BOT_TOKEN") || '', '');
  return tempProcessor.fetchWithRetry(url, options, maxRetries, initialRetryDelay);
}

/**
 * @deprecated Use MediaProcessor.checkFileExistsInStorage (checks Storage) or implement a specific database check if needed. MediaProcessor focuses on storage duplicates.
 * This function will be removed in a future release.
 */
// Improved function to find existing file (checks database)
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  console.warn('xdelo_findExistingFile is deprecated. Use MediaProcessor.checkFileExistsInStorage (checks Storage) or implement a specific database check if needed.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor(supabase, '', '');
  return tempProcessor.findExistingFile(fileUniqueId);
}

/**
 * @deprecated Use MediaProcessor.checkFileExistsInStorage instead.
 * This function will be removed in a future release.
 */
// Check if file exists in storage
export async function xdelo_verifyFileExists(
  supabase: SupabaseClient,
  storagePath: string,
  bucket: string = 'telegram-media'
): Promise<boolean> {
  console.warn('xdelo_verifyFileExists is deprecated. Use MediaProcessor.checkFileExistsInStorage instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor(supabase, '', '');
  return tempProcessor.verifyFileExists(storagePath, bucket);
}

/**
 * @deprecated Use MediaProcessor.uploadMediaToStorage instead.
 * This function will be removed in a future release.
 */
// Upload file to storage with improved error handling
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string,
  messageId?: string,
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  console.warn('xdelo_uploadMediaToStorage is deprecated. Use MediaProcessor.uploadMediaToStorage instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, '', '');
  return tempProcessor.uploadMediaToStorage(storagePath, fileData as ArrayBuffer, mimeType, messageId, bucket);
}

/**
 * @deprecated Use MediaProcessor.downloadMediaFromTelegram instead.
 * This function will be removed in a future release.
 */
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
  console.warn('xdelo_downloadMediaFromTelegram is deprecated. Use MediaProcessor.downloadMediaFromTelegram instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, telegramBotToken, '');
  try {
    const result = await tempProcessor.downloadMediaFromTelegram(fileId, 'deprecated-call'); // Need a correlationId
    return { success: true, blob: new Blob([result]), mimeType: mimeType, storagePath: undefined }; // Adapt result
  } catch (error) {
      return { success: false, error: error.message };
  }
}

/**
 * @deprecated Use MediaProcessor.processMedia instead.
 * This function will be removed in a future release.
 */
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
  console.warn('xdelo_processMessageMedia is deprecated. Use MediaProcessor.processMedia instead.');
  // Create a temporary MediaProcessor instance to use the method
  const tempProcessor = new MediaProcessor({} as SupabaseClient, telegramBotToken, '');
  return Promise.resolve({ success: false, isDuplicate: false, fileInfo: {}, error: 'Deprecated function cannot be adapted easily.' });
  // const mediaContent = extractMediaContent(telegramData); // Assuming extractMediaContent exists and works
  // if (!mediaContent) return { success: false, ... };
  // return tempProcessor.processMedia(mediaContent, 'deprecated-call'); // Requires correlationId and adaptation
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
export function createMediaProcessor(
  supabaseClient: SupabaseClient,
  telegramBotToken: string,
  storageBucket: string = 'telegram-media'
): MediaProcessor {
  return MediaProcessor.createMediaProcessor(supabaseClient, telegramBotToken, storageBucket);
}

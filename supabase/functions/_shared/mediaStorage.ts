import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import type { Database } from "../../types/database.types.ts";
import {
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_detectMimeType
} from "./mediaUtils.ts";

interface DownloadResult {
  success: boolean;
  blob?: Blob;
  storagePath?: string;
  mimeType?: string;
  error?: string;
  attempts?: number;
}

interface UploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

interface FileInfo {
  storage_path: string;
  mime_type: string;
  file_size: number;
  public_url: string;
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
  const supabaseUrl = Deno?.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      isDuplicate: false,
      fileInfo: null,
      error: 'Missing Supabase credentials'
    };
  }

  const supabase = createClient<Database>(
    supabaseUrl,
    supabaseKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 1. Check for existing file first
  const findResult = await xdelo_findExistingFile(supabase, fileUniqueId)
    .catch(() => ({ exists: false }));

  if (findResult.exists && 'message' in findResult && findResult.message) {
    const existingMessage = findResult.message;
    console.log(`Found existing file: ${fileUniqueId}`);
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

  // 2. Try to process new file
  let fileInfo: FileInfo | null = null;
  const detectedMimeType = xdelo_detectMimeType(message);

  // Download with error handling
  const downloadResult: DownloadResult = await xdelo_downloadMediaFromTelegram(
    fileId,
    fileUniqueId,
    detectedMimeType,
    telegramBotToken
  ).catch((e) => ({
    success: false,
    error: e instanceof Error ? e.message : 'Download failed'
  }));

  if (downloadResult.success && downloadResult.blob && downloadResult.storagePath) {
    // Upload with error handling
    const uploadResult: UploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath,
      downloadResult.blob,
      downloadResult.mimeType || detectedMimeType,
      messageId
    ).catch((e) => ({
      success: false,
      error: e instanceof Error ? e.message : 'Upload failed'
    }));

    if (uploadResult.success && uploadResult.publicUrl) {
      fileInfo = {
        storage_path: downloadResult.storagePath,
        mime_type: downloadResult.mimeType || detectedMimeType,
        file_size: downloadResult.blob.size,
        public_url: uploadResult.publicUrl
      };
    }
  }

  // Return best possible result
  return {
    success: fileInfo !== null,
    isDuplicate: false,
    fileInfo,
    error: !fileInfo ?
      (downloadResult.error || 'Media processing incomplete') :
      undefined
  };
}

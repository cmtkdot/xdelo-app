import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_detectMimeType
} from "./mediaUtils.ts";

/**
 * Find an existing file in the database by file_unique_id
 */
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  try {
    if (!fileUniqueId) {
      return { exists: false };
    }
    
    // Find message with this file_unique_id
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking for existing file:', error);
      return { exists: false };
    }

    if (data && data.length > 0) {
      // Verify the file actually exists in storage
      const existingMessage = data[0];
      if (existingMessage.storage_path) {
        const storageExists = await xdelo_verifyFileExists(
          supabase, 
          existingMessage.storage_path
        );
        
        if (storageExists) {
          return { exists: true, message: existingMessage };
        }
      }
    }

    return { exists: false };
  } catch (error) {
    console.error('Unexpected error checking for existing file:', error);
    return { exists: false };
  }
}

/**
 * Check if file exists in storage
 */
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

/**
 * Process message media from Telegram, handling download and upload
 */
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
    // First check if this is a duplicate file
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
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
      downloadResult.storagePath!,
      downloadResult.blob,
      downloadResult.mimeType || mimeType,
      messageId
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
    
    // Step 7: If messageId provided but not yet updated
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
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

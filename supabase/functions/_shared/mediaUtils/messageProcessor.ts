
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
    
    // Import other utilities
    const { xdelo_findExistingFile } = await import('./duplicateDetection.ts');
    const { xdelo_detectMimeType } = await import('./mimeTypes.ts');
    const { xdelo_downloadMediaFromTelegram } = await import('./telegramDownloader.ts');
    const { xdelo_uploadMediaToStorage } = await import('./uploadUtils.ts');
    
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

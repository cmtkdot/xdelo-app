import { supabase } from "./baseUtils.ts";

/**
 * Download file from Telegram
 */
async function downloadFromTelegram(fileId: string, botToken: string): Promise<Response> {
  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${fileId}`,
    { method: 'GET' }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
  }
  
  return response;
}

/**
 * Check if file already exists in storage
 */
async function checkFileExists(fileUniqueId: string): Promise<{ exists: boolean; existingMessage?: any }> {
  try {
    // Check if we already have this file
    const { data: existingMessages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('storage_exists', true)
      .limit(1);
      
    if (error) {
      console.error('Error checking for existing file:', error);
      return { exists: false };
    }
    
    if (existingMessages && existingMessages.length > 0) {
      return { 
        exists: true, 
        existingMessage: existingMessages[0] 
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error in checkFileExists:', error);
    return { exists: false };
  }
}

/**
 * Process message media - downloading from Telegram and uploading to storage
 */
export async function xdelo_processMessageMedia(
  message: any,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string,
  messageId: string
): Promise<{ success: boolean; isDuplicate?: boolean; fileInfo?: any; error?: string }> {
  try {
    console.log(`Processing media for message ID ${messageId}, file_id: ${fileId}`);
    
    // Check for existing file first
    const { exists, existingMessage } = await checkFileExists(fileUniqueId);
    if (exists && existingMessage) {
      console.log(`File ${fileUniqueId} already exists, reusing...`);
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingMessage.storage_path,
          public_url: existingMessage.public_url,
          mime_type: existingMessage.mime_type,
          file_size: existingMessage.file_size
        }
      };
    }
    
    // First get the file path from Telegram
    const getFileResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      { method: 'GET' }
    );
    
    if (!getFileResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${getFileResponse.statusText}`);
    }
    
    const fileInfo = await getFileResponse.json();
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error('Failed to get file path from Telegram');
    }
    
    // Download the file from Telegram
    const fileResponse = await downloadFromTelegram(fileInfo.result.file_path, telegramBotToken);
    const fileBlob = await fileResponse.blob();
    
    // Determine mime type
    let mimeType = message.photo ? 'image/jpeg' : 
                   message.video ? message.video.mime_type || 'video/mp4' : 
                   message.document ? message.document.mime_type || 'application/octet-stream' :
                   'application/octet-stream';
    
    // Generate storage path
    const fileExtension = mimeType.split('/')[1] || 'bin';
    const storagePath = `telegram-media/${fileUniqueId}.${fileExtension}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, fileBlob, {
        contentType: mimeType,
        upsert: true
      });
      
    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    return {
      success: true,
      isDuplicate: false,
      fileInfo: {
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        file_size: fileBlob.size
      }
    };
  } catch (error) {
    console.error(`Error processing media: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

import { supabase } from './core.ts';
import { TelegramMessage } from './types.ts';

/**
 * Download media file from Telegram
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
  error?: string 
}> {
  try {
    // Get file path from Telegram
    const getFileResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      { method: 'GET' }
    );
    
    if (!getFileResponse.ok) {
      throw new Error(`Failed to get file info: ${getFileResponse.statusText}`);
    }
    
    const fileInfo = await getFileResponse.json();
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error('Failed to get file path');
    }
    
    // Download the file
    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      { method: 'GET' }
    );
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    
    const blob = await fileResponse.blob();
    const extension = fileInfo.result.file_path.split('.').pop() || 'bin';
    const storagePath = `${fileUniqueId}.${extension}`;
    
    return {
      success: true,
      blob,
      storagePath,
      mimeType: mimeType || 'application/octet-stream'
    };
  } catch (error) {
    console.error('Error downloading from Telegram:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload media to Supabase Storage
 */
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  blob: Blob,
  mimeType: string,
  messageId?: string
): Promise<{
  success: boolean;
  storage_path?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .storage
      .from('media')
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: true
      });
      
    if (error) {
      throw error;
    }
    
    const { data: publicUrl } = supabase
      .storage
      .from('media')
      .getPublicUrl(storagePath);
      
    return {
      success: true,
      storage_path: storagePath,
      public_url: publicUrl.publicUrl,
      mime_type: mimeType,
      file_size: blob.size
    };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process message media from Telegram to Storage
 */
export async function xdelo_processMessageMedia(
  message: TelegramMessage,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string,
  messageId?: string
): Promise<{ 
  success: boolean; 
  isDuplicate?: boolean; 
  fileInfo?: any; 
  error?: string 
}> {
  try {
    // Check for existing file
    const { data: existingFile } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('storage_exists', true)
      .limit(1);
      
    if (existingFile && existingFile.length > 0) {
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingFile[0].storage_path,
          public_url: existingFile[0].public_url,
          mime_type: existingFile[0].mime_type,
          file_size: existingFile[0].file_size
        }
      };
    }
    
    // Detect MIME type
    const mimeType = message.photo ? 'image/jpeg' : 
                    message.video ? message.video.mime_type || 'video/mp4' : 
                    message.document ? message.document.mime_type || 'application/octet-stream' :
                    'application/octet-stream';
    
    // Download from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      fileId,
      fileUniqueId,
      mimeType,
      telegramBotToken
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(`Failed to download media: ${downloadResult.error || 'Unknown error'}`);
    }
    
    // Upload to Storage
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath || `${fileUniqueId}.bin`,
      downloadResult.blob,
      downloadResult.mimeType || mimeType,
      messageId
    );
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload media: ${uploadResult.error}`);
    }
    
    return {
      success: true,
      isDuplicate: false,
      fileInfo: uploadResult
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Find messages in a media group
 */
export async function xdelo_findMediaGroupMessages(
  mediaGroupId: string,
  excludeMessageId?: string
): Promise<any[]> {
  if (!mediaGroupId) {
    return [];
  }

  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (excludeMessageId) {
      query = query.neq('id', excludeMessageId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error finding media group messages:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception finding media group messages:', error);
    return [];
  }
} 
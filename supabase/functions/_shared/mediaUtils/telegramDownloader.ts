
import { xdelo_fetchWithRetry, rateLimitTracker } from './fetchUtils';
import { xdelo_generateStoragePath } from './storagePaths';
import { corsHeaders } from './corsUtils';
import { xdelo_findAlternativeFileInMediaGroup, xdelo_markMessageForRedownload } from '../messageUtils';

// Download media from Telegram with improved error handling
export async function xdelo_downloadMediaFromTelegram(
  fileId: string,
  fileUniqueId: string,
  mimeType: string,
  telegramBotToken: string,
  messageId?: string,
  mediaGroupId?: string
): Promise<{ 
  success: boolean; 
  blob?: Blob; 
  storagePath?: string; 
  mimeType?: string;
  error?: string;
  attempts?: number;
  fallbackUsed?: boolean;
}> {
  try {
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    console.log(`Starting download process for file ${fileId} (${fileUniqueId})`);
    
    // Get file info from Telegram with improved retry logic
    console.log(`Fetching file info for ${fileId}`);
    
    try {
      const fileInfoResponse = await xdelo_fetchWithRetry(
        `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
        { 
          method: 'GET',
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        },
        5,
        800
      );
      
      const fileInfo = await fileInfoResponse.json();
      
      if (!fileInfo.ok) {
        throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
      }
      
      if (!fileInfo.result?.file_path) {
        throw new Error(`Invalid file info response from Telegram: ${JSON.stringify(fileInfo)}`);
      }
      
      console.log(`Successfully retrieved file path: ${fileInfo.result.file_path}`);
      
      // Download file from Telegram with enhanced retry logic
      console.log(`Downloading file from path ${fileInfo.result.file_path}`);
      
      const fileDataResponse = await xdelo_fetchWithRetry(
        `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
        { 
          method: 'GET',
          headers: corsHeaders
        },
        5,
        1000
      );
      
      const fileData = await fileDataResponse.blob();
      
      // Validate the downloaded data
      if (!fileData || fileData.size === 0) {
        throw new Error('Downloaded empty file from Telegram');
      }
      
      console.log(`Successfully downloaded file: ${fileData.size} bytes`);
      
      // Try to detect MIME type from file extension if not provided
      let detectedMimeType = mimeType;
      if (!detectedMimeType || detectedMimeType === 'application/octet-stream') {
        // Extract extension from file_path
        const extension = fileInfo.result.file_path.split('.').pop()?.toLowerCase();
        if (extension) {
          // Map common extensions back to MIME types
          const extensionMimeMap: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          };
          
          if (extensionMimeMap[extension]) {
            detectedMimeType = extensionMimeMap[extension];
            console.log(`Detected MIME type from file extension: ${detectedMimeType}`);
          }
        }
      }
      
      // Generate storage path
      const storagePath = xdelo_generateStoragePath(fileUniqueId, detectedMimeType);
      console.log(`Generated storage path: ${storagePath} with MIME type: ${detectedMimeType}`);
      
      return {
        success: true,
        blob: fileData,
        storagePath,
        mimeType: detectedMimeType,
        attempts: 1
      };
    } catch (error) {
      // Handle file_id expired errors by trying to find alternative in the same media group
      if (error.message && error.message.includes('wrong file_id') && messageId && mediaGroupId) {
        console.log(`File ID ${fileId} has expired. Marking message ${messageId} for redownload`);
        
        // Flag the message for redownload through our batch process
        await xdelo_markMessageForRedownload(messageId, 'expired_file_id');
        
        // Try to find an alternative file in the same media group
        console.log(`Searching for alternative file in media group ${mediaGroupId}`);
        const alternativeMessage = await xdelo_findAlternativeFileInMediaGroup(
          mediaGroupId, 
          fileUniqueId,
          messageId
        );
        
        if (alternativeMessage && alternativeMessage.file_id) {
          console.log(`Found alternative file_id ${alternativeMessage.file_id} in message ${alternativeMessage.id}`);
          
          // Try downloading with the alternative file_id
          const alternativeResult = await xdelo_downloadMediaFromTelegram(
            alternativeMessage.file_id,
            fileUniqueId,
            mimeType,
            telegramBotToken
          );
          
          if (alternativeResult.success) {
            console.log(`Successfully downloaded using alternative file_id from message ${alternativeMessage.id}`);
            return {
              ...alternativeResult,
              fallbackUsed: true
            };
          }
        }
      }
      
      throw error; // Re-throw if we couldn't handle it or find an alternative
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // Add more detailed error information for debugging
    const errorDetails = {
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      file_id: fileId,
      file_unique_id: fileUniqueId
    };
    
    console.error('Download error details:', JSON.stringify(errorDetails, null, 2));
    
    return {
      success: false,
      error: `Download failed: ${error.message}`,
      attempts: 5
    };
  }
}

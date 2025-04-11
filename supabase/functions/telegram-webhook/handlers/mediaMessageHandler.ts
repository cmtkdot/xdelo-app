
import { supabaseClient } from '../../_shared/supabaseClient.ts';
import { logWithCorrelation } from '../utils/logger.ts';
import { upsertMediaMessageRecord, findMessageByTelegramId, findMessageByFileUniqueId, extractForwardInfo } from '../utils/dbOperations.ts';
import { MessageContext, TelegramMessage } from '../types.ts';
import { RetryHandler, createRetryHandler } from '../../_shared/retryHandler.ts';
import { corsHeaders } from '../../_shared/cors.ts';

// Function to handle new messages
export async function handleNewMessage(message, telegram_token, correlationId, fileUniqueId, fileId, mediaType, mimeType, extension) {
  try {
    logWithCorrelation(correlationId, `Processing new message ${message.message_id}`, 'INFO', 'handleNewMessage');

    // Process the caption using a retry handler to ensure it works even if there are temporary issues
    const captionRetryHandler = createRetryHandler({
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffFactor: 2.0
    });

    const captionResult = await captionRetryHandler.execute(
      async () => processCaptionText(message.caption || '', correlationId),
      {
        operationName: 'processCaptionText',
        correlationId,
        contextData: { captionLength: (message.caption || '').length }
      }
    );

    let captionData = null;
    if (captionResult.success && captionResult.result) {
      captionData = captionResult.result;
    }

    // Process media file
    const mediaResult = await processMedia(telegram_token, fileUniqueId, fileId, mediaType, mimeType, extension, correlationId);
    
    logWithCorrelation(correlationId, `Media processing status for message ${message.message_id}: ${mediaResult.success ? 'success' : 'failed'} -> DB state: ${mediaResult.dbState || 'unknown'}`, 'INFO', 'handleNewMessage');

    // Extract forward information if message is forwarded
    const forwardInfo = extractForwardInfo(message);

    // Check if caption has changed compared to existing record
    const existingMessageResult = await findMessageByTelegramId(supabaseClient, message.message_id, message.chat.id, correlationId);
    if (existingMessageResult.success && 
        existingMessageResult.message && 
        existingMessageResult.message.caption !== message.caption) {
      
      logWithCorrelation(correlationId, `Caption changed for message ${message.message_id}. Old: "${existingMessageResult.message.caption}", New: "${message.caption}"`, 'INFO', 'handleNewMessage');
    }

    // Upsert the message record with all the necessary parameters
    const messageResult = await upsertMediaMessageRecord({
      supabaseClient,
      messageId: message.message_id,
      chatId: message.chat.id,
      caption: message.caption,
      mediaType,
      fileId,
      fileUniqueId,
      storagePath: mediaResult.storagePath,
      publicUrl: mediaResult.publicUrl,
      mimeType,
      extension,
      messageData: message,
      processingState: 'initialized',
      processingError: null,
      forwardInfo,
      mediaGroupId: message.media_group_id,
      captionData,
      analyzedContent: captionData,
      oldAnalyzedContent: null, // Explicitly passing null for new messages
      correlationId
    });

    if (!messageResult.success) {
      throw new Error(`Failed to create message: ${messageResult.error}`);
    }

    return messageResult;
  } catch (error) {
    console.error(`[handleNewMessage] ${error.message}`);
    logWithCorrelation(correlationId, `Failed to create message: ${error}`, 'ERROR', 'handleNewMessage');
    throw error;
  }
}

// Process caption text and extract structured data
async function processCaptionText(caption, correlationId) {
  try {
    if (!caption) return null;
    
    // This is a simple transformation for now
    // In a real app, you'd have more complex parsing logic here
    return {
      text: caption,
      parsed: {
        extractedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logWithCorrelation(correlationId, `Error processing caption: ${error.message}`, 'ERROR', 'processCaptionText');
    return null;
  }
}

// Function to check if file exists in storage
async function checkFileExistsInStorage(fileUniqueId, extension, correlationId) {
  try {
    logWithCorrelation(correlationId, `Checking if file ${fileUniqueId}.${extension} exists in storage`, 'INFO', 'checkFileExistsInStorage');
    
    // First check if the file exists in the database
    const existingFileResult = await findMessageByFileUniqueId(supabaseClient, fileUniqueId, correlationId);
    
    if (existingFileResult.success && existingFileResult.data) {
      logWithCorrelation(correlationId, `Found existing file record in database with file_unique_id ${fileUniqueId}`, 'INFO', 'checkFileExistsInStorage');
      
      // Check if the file exists in storage
      const { data, error } = await supabaseClient
        .storage
        .from('media')
        .getPublicUrl(`${fileUniqueId}.${extension}`);
      
      if (error) {
        logWithCorrelation(correlationId, `Error checking file in storage: ${error.message}`, 'ERROR', 'checkFileExistsInStorage');
        return { exists: false };
      }
      
      logWithCorrelation(correlationId, `Verified file exists in storage at path ${fileUniqueId}.${extension}`, 'INFO', 'checkFileExistsInStorage');
      
      return {
        exists: true,
        path: `${fileUniqueId}.${extension}`,
        publicUrl: data.publicUrl,
        mimeType: existingFileResult.data.mime_type,
        storagePath: `${fileUniqueId}.${extension}`
      };
    }
    
    return { exists: false };
  } catch (error) {
    logWithCorrelation(correlationId, `Error checking file existence: ${error.message}`, 'ERROR', 'checkFileExistsInStorage');
    return { exists: false, error: error.message };
  }
}

// Process media files
async function processMedia(telegramToken, fileUniqueId, fileId, mediaType, mimeType, extension, correlationId) {
  try {
    logWithCorrelation(correlationId, `Processing media ${fileUniqueId}`, 'INFO', 'processMedia');
    
    logWithCorrelation(correlationId, `Processing media with fileUniqueId: ${fileUniqueId}, fileId: ${fileId}`, 'INFO', 'processMedia', { mediaType, mimeType, extension });
    
    // Check if file already exists in storage
    const fileExistsResult = await checkFileExistsInStorage(fileUniqueId, extension, correlationId);
    
    if (fileExistsResult.exists) {
      logWithCorrelation(correlationId, `Using existing file ${fileUniqueId}.${extension}`, 'INFO', 'processMedia');
      
      // Get file MIME type information
      const fileInfo = await fetch(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`)
        .then(res => res.json());
      
      const contentDisposition = 'inline'; // Default disposition
      
      logWithCorrelation(correlationId, `File MIME type: ${mimeType}, Content-Disposition: ${contentDisposition}`, 'INFO', 'processMedia');
      
      return {
        success: true,
        dbState: 'completed',
        storagePath: fileExistsResult.path,
        publicUrl: fileExistsResult.publicUrl,
        mimeType: fileExistsResult.mimeType || mimeType
      };
    }
    
    // If file doesn't exist, we could download it here
    // For now, just return a placeholder
    return {
      success: false,
      dbState: 'error',
      error: 'File does not exist and download not implemented',
      storagePath: null,
      publicUrl: null,
      mimeType
    };
  } catch (error) {
    logWithCorrelation(correlationId, `Error processing media: ${error.message}`, 'ERROR', 'processMedia');
    return {
      success: false,
      dbState: 'error',
      error: error.message,
      storagePath: null,
      publicUrl: null,
      mimeType
    };
  }
}

// Check if message already exists
async function checkMessageExists(telegramMessageId, chatId, correlationId) {
  try {
    logWithCorrelation(correlationId, `Checking for message ${telegramMessageId} in chat ${chatId}`, 'INFO', 'checkMessageExists');
    const result = await findMessageByTelegramId(supabaseClient, telegramMessageId, chatId, correlationId);
    return result;
  } catch (error) {
    logWithCorrelation(correlationId, `Error checking message existence: ${error.message}`, 'ERROR', 'checkMessageExists');
    return { success: false, error: error.message };
  }
}

// Main media message handler
export async function handleMediaMessage(telegramToken, message, context) {
  const { correlationId, isEdit } = context;
  
  try {
    logWithCorrelation(correlationId, `Processing message ${message.message_id} in chat ${message.chat.id}`, 'INFO', 'handleMediaMessage');
    
    // Check if message already exists
    const existingMessageResult = await checkMessageExists(message.message_id, message.chat.id, correlationId);
    
    // Identify the media type and file details
    let mediaType, fileId, fileUniqueId, mimeType, extension;
    
    if (message.photo) {
      // For photos, use the largest size (last in array)
      mediaType = 'photo';
      const photo = message.photo[message.photo.length - 1];
      fileId = photo.file_id;
      fileUniqueId = photo.file_unique_id;
      mimeType = 'image/jpeg';
      extension = 'jpg';
    } else if (message.video) {
      mediaType = 'video';
      fileId = message.video.file_id;
      fileUniqueId = message.video.file_unique_id;
      mimeType = message.video.mime_type || 'video/mp4';
      extension = 'mp4';
    } else if (message.document) {
      mediaType = 'document';
      fileId = message.document.file_id;
      fileUniqueId = message.document.file_unique_id;
      mimeType = message.document.mime_type || 'application/octet-stream';
      
      // Try to extract extension from filename or mime type
      if (message.document.file_name) {
        const parts = message.document.file_name.split('.');
        if (parts.length > 1) {
          extension = parts[parts.length - 1];
        } else {
          extension = 'bin';
        }
      } else {
        // Extract extension from mime type
        const mimeParts = mimeType.split('/');
        if (mimeParts.length > 1) {
          extension = mimeParts[1].split(';')[0];
        } else {
          extension = 'bin';
        }
      }
    } else {
      throw new Error('Unsupported media type');
    }
    
    // If message already exists and it's an edit, handle edit flow
    if (existingMessageResult.success && isEdit) {
      // Handle edited message (not implemented yet)
      throw new Error('Edited message handling not implemented');
    }
    
    // Process new message
    const messageResult = await handleNewMessage(
      message, 
      telegramToken, 
      correlationId, 
      fileUniqueId, 
      fileId, 
      mediaType, 
      mimeType, 
      extension
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        operation: 'media_message_processed',
        messageId: messageResult.data?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logWithCorrelation(correlationId, `Error handling media message: ${error.message}`, 'ERROR', 'handleMediaMessage');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to process media message: ${error.message}`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

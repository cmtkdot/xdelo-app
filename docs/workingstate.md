
// supabase/functions/telegram-webhook-standalone/index.ts
// Import Supabase JS client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
// Type definitions
interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    title?: string;
    type: string;
  };
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration?: number;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    mime_type?: string;
    file_size?: number;
  };
  caption?: string;
  edit_date?: number;
  media_group_id?: string;
  forward_origin?: {
    type: string;
    chat?: {
      id: number;
      title?: string;
      type: string;
    };
    message_id?: number;
    date: number;
  };
}
interface MessageContext {
  correlationId: string;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
  isChannelPost?: boolean;
  isForwarded?: boolean;
}
interface ForwardInfo {
  is_forwarded: boolean;
  forward_origin_type: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  forward_date: string;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}
interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  mime_type_original?: string;
  storage_path: string;
  public_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
  correlation_id: string;
  processing_state: string;
  is_edited_channel_post?: boolean;
  forward_info?: ForwardInfo;
  telegram_data: any;
  edit_date?: string;
  is_forward?: boolean;
  edit_history?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
  [key: string]: any;
}
// Constants and environment variables
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
}
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}
// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Determine if a file should be viewable in browser based on its MIME type
 */
function isViewableMimeType(mimeType: string): boolean {
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
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const extensionMap: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
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
    'application/x-tgsticker': 'tgs',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    
    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'text/csv': 'csv',
    
    // Others
    'application/json': 'json',
    'application/xml': 'xml',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/x-7z-compressed': '7z',
    'application/x-rar-compressed': 'rar'
  };
  // If we have an exact match, use it
  if (extensionMap[mimeType]) {
    return extensionMap[mimeType];
  }
  
  // Otherwise extract the subtype
  const subtype = mimeType.split('/')[1];
  if (subtype) {
    // Clean up the subtype (remove parameters, etc.)
    const cleanSubtype = subtype.split(';')[0].trim();
    return cleanSubtype || 'bin';
  }
  
  return 'bin'; // Default fallback
}
/**
 * Detect MIME type from Telegram message
 */
function detectMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  // Log the telegram data for debugging
  console.log('Detecting MIME type from telegram data:', JSON.stringify({
    has_photo: !!telegramData.photo,
    has_document: !!telegramData.document,
    has_video: !!telegramData.video,
    document_mime_type: telegramData.document?.mime_type,
    video_mime_type: telegramData.video?.mime_type
  }));
  
  // Handle photo (always JPEG from Telegram)
  if (telegramData.photo && telegramData.photo.length > 0) {
    return 'image/jpeg';
  }
  
  // Use mime_type from document if available
  if (telegramData.document?.mime_type) {
    console.log(`Using document mime_type: ${telegramData.document.mime_type}`);
    return telegramData.document.mime_type;
  }
  
  // Use mime_type from video if available
  if (telegramData.video?.mime_type) {
    console.log(`Using video mime_type: ${telegramData.video.mime_type}`);
    return telegramData.video.mime_type;
  }
  
  // Handle other media types with specific detection
  if (telegramData.video) return 'video/mp4';
  if (telegramData.audio) return telegramData.audio.mime_type || 'audio/mpeg';
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  // Default fallback
  console.warn('Could not detect MIME type from telegram data, falling back to octet-stream');
  return 'application/octet-stream';
}
/**
 * Generate standardized storage path
 */
function generateStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('Missing file_unique_id for storage path generation');
  }
  
  const extension = getExtensionFromMimeType(mimeType || 'application/octet-stream');
  return `${fileUniqueId}.${extension}`;
}
/**
 * Get upload options with proper content disposition
 */
function getUploadOptions(mimeType: string): Record<string, any> {
  const isViewable = isViewableMimeType(mimeType);
  
  return {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    cacheControl: '3600',
    contentDisposition: isViewable ? 'inline' : 'attachment'
  };
}
/**
 * Enhanced fetch function with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 5,
  initialRetryDelay: number = 500
): Promise<Response> {
  let retryCount = 0;
  let retryDelay = initialRetryDelay;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal
      };
      
      console.log(`Attempt ${retryCount + 1}/${maxRetries} to fetch ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to get response text');
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${responseText.substring(0, 200)}`);
      }
      
      console.log(`Successfully fetched ${url.substring(0, 100)} on attempt ${retryCount + 1}`);
      return response;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Log the error
      console.warn(`Fetch attempt ${retryCount}/${maxRetries} failed for ${url.substring(0, 100)}: ${error.message}`);
      
      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
        console.error(`All ${maxRetries} retry attempts failed for ${url.substring(0, 100)}`);
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Exponential backoff with jitter
      retryDelay = Math.min(
        retryDelay * 2 * (0.8 + Math.random() * 0.4),
        60000
      );
    }
  }
  
  // This should never execute but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch');
}
/**
 * Download media from Telegram
 */
async function downloadMediaFromTelegram(
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
}> {
  try {
    if (!telegramBotToken) {
      throw new Error('Telegram bot token is required');
    }
    
    console.log(`Starting download process for file ${fileId} (${fileUniqueId})`);
    
    // Get file info from Telegram
    console.log(`Fetching file info for ${fileId}`);
    
    const fileInfoResponse = await fetchWithRetry(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`,
      { 
        method: 'GET',
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    if (!fileInfo.result?.file_path) {
      throw new Error(`Invalid file info response from Telegram: ${JSON.stringify(fileInfo)}`);
    }
    
    console.log(`Successfully retrieved file path: ${fileInfo.result.file_path}`);
    
    // Download file from Telegram
    console.log(`Downloading file from path ${fileInfo.result.file_path}`);
    
    const fileDataResponse = await fetchWithRetry(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`,
      { 
        method: 'GET',
        headers: corsHeaders
      }
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
    const storagePath = generateStoragePath(fileUniqueId, detectedMimeType);
    console.log(`Generated storage path: ${storagePath} with MIME type: ${detectedMimeType}`);
    
    return {
      success: true,
      blob: fileData,
      storagePath,
      mimeType: detectedMimeType
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    return {
      success: false,
      error: `Download failed: ${error.message}`
    };
  }
}
/**
 * Upload file to storage
 */
async function uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string,
  messageId?: string
): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    console.log(`Uploading file to storage: ${storagePath} with MIME type: ${mimeType}`);
    
    // Get correct upload options based on mime type
    const uploadOptions = getUploadOptions(mimeType);
    
    // Upload the file with retry for network stability
    let uploadError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error } = await supabaseClient.storage
          .from('telegram-media')
          .upload(storagePath, fileData, uploadOptions);
          
        if (!error) {
          uploadError = null;
          break;
        }
        
        uploadError = error;
        console.warn(`Upload attempt ${attempt}/3 failed for ${storagePath}: ${error.message}`);
        
        // Wait with exponential backoff before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      } catch (err) {
        uploadError = err;
        console.warn(`Upload attempt ${attempt}/3 failed for ${storagePath}: ${err.message}`);
        
        // Wait with exponential backoff before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    if (uploadError) {
      throw new Error(`Storage upload failed after 3 attempts: ${uploadError.message}`);
    }
    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/telegram-media/${storagePath}`;
    console.log(`File uploaded successfully, public URL: ${publicUrl}`);
    
    // If messageId provided, update the message with the public URL
    if (messageId) {
      await supabaseClient
        .from('messages')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          storage_exists: true,
          storage_path_standardized: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return { 
      success: true, 
      publicUrl
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
/**
 * Check for duplicate file
 */
async function checkDuplicateFile(fileUniqueId: string): Promise<any> {
  try {
    if (!fileUniqueId) {
      return null;
    }
    
    // Find message with this file_unique_id
    const { data: existingMessages, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !existingMessages?.length) {
      return null;
    }
    
    return existingMessages[0];
  } catch (error) {
    console.error('Error checking duplicate file:', error);
    return null;
  }
}
/**
 * Create a new message record
 */
async function createMessage(messageInput: MessageInput): Promise<{ success: boolean; id?: string; error_message?: string }> {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .insert([messageInput])
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating message:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
    
    return {
      success: true,
      id: data.id
    };
  } catch (error) {
    console.error('Error in createMessage:', error);
    return {
      success: false,
      error_message: error.message
    };
  }
}
/**
 * Process caption changes
 */
async function processCaptionChanges(
  messageId: string,
  caption: string,
  mediaGroupId: string | undefined,
  correlationId: string,
  isEdit: boolean
): Promise<void> {
  console.log(`[${correlationId}] Processing caption for message ${messageId}`);
  
  try {
    // Use direct caption processor with manual-caption-parser
    const captionProcessorUrl = `${SUPABASE_URL}/functions/v1/manual-caption-parser`;
    const processorResponse = await fetch(captionProcessorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-client-info': 'telegram-webhook'
      },
      body: JSON.stringify({
        messageId: messageId,
        caption: caption,
        mediaGroupId: mediaGroupId,
        correlationId: correlationId,
        triggerSource: 'webhook_handler',
        forceReprocess: isEdit // Force reprocess for edits
      })
    });
    
    if (!processorResponse.ok) {
      // Read the error message and status for better diagnostics
      const errorText = await processorResponse.text();
      throw new Error(`Manual parser error: ${processorResponse.status} ${processorResponse.statusText} - ${errorText}`);
    }
    
    const processorResult = await processorResponse.json();
    console.log(`[${correlationId}] Manual caption processing successful:`, processorResult);
  } catch (directError) {
    console.error(`[${correlationId}] Manual caption processor failed:`, directError);
    
    // Log the failure
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'caption_processing_failed',
        entity_id: messageId,
        error_message: directError.message,
        metadata: {
          correlationId,
          caption_length: caption.length,
          media_group_id: mediaGroupId,
          is_edit: isEdit,
          timestamp: new Date().toISOString()
        },
        correlation_id: correlationId
      });
      
      // Update message to error state
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: `Caption processing failed: ${directError.message}`,
          error_code: 'CAPTION_PROCESSING_ERROR',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
    } catch (logError) {
      console.error(`[${correlationId}] Failed to log caption processing error:`, logError);
    }
  }
}
/**
 * Handle removed caption in a media group
 */
async function handleRemovedCaption(
  messageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<void> {
  try {
    console.log(`[${correlationId}] Caption removed, checking for media group sync from group ${mediaGroupId}`);
    
    // Use the RPC function to check and sync with media group
    const { error: syncError } = await supabaseClient.rpc(
      'xdelo_check_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_message_id: messageId,
        p_correlation_id: correlationId
      }
    );
    
    if (syncError) {
      console.error(`[${correlationId}] Error checking media group content:`, syncError);
    }
  } catch (error) {
    console.error(`[${correlationId}] Failed to sync with media group after caption removal:`, error);
  }
}
/**
 * Check if we need to sync with media group
 */
async function checkMediaGroupSync(
  messageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<void> {
  try {
    console.log(`[${correlationId}] Message ${messageId} has no caption but is part of media group ${mediaGroupId}, checking for content`);
    
    // Use the RPC function to check and sync with media group
    const { data: syncResult, error: syncError } = await supabaseClient.rpc(
      'xdelo_check_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_message_id: messageId,
        p_correlation_id: correlationId
      }
    );
    
    if (syncError) {
      console.error(`[${correlationId}] Error checking media group content:`, syncError);
    } else if (syncResult && syncResult.success) {
      console.log(`[${correlationId}] Successfully synced content from media group ${mediaGroupId} to message ${messageId}`);
    } else if (syncResult && !syncResult.success) {
      console.log(`[${correlationId}] No content to sync: ${syncResult.reason}`);
      
      // If no content to sync, set a delayed re-check
      console.log(`[${correlationId}] Scheduling a delayed re-check for media group ${mediaGroupId} after 10 seconds`);
      setTimeout(async () => {
        try {
          console.log(`[${correlationId}] Performing delayed re-check for message ${messageId} in group ${mediaGroupId}`);
          await supabaseClient.rpc(
            'xdelo_check_media_group_content',
            {
              p_media_group_id: mediaGroupId,
              p_message_id: messageId,
              p_correlation_id: correlationId
            }
          );
        } catch (delayedError) {
          console.error(`[${correlationId}] Delayed media group check failed:`, delayedError);
        }
      }, 10000); // 10 second delay
    }
  } catch (error) {
    console.error(`[${correlationId}] Failed to check media group sync:`, error);
  }
}
// ============================================================================
// Media Message Handlers
// ============================================================================
/**
 * Handle edited media messages (continued)
 */
async function handleEditedMediaMessage(
    message: TelegramMessage, 
    context: MessageContext,
    previousMessage: TelegramMessage
  ): Promise<Response> {
    const { correlationId } = context;
    
    // Find the existing message by telegram_message_id and chat_id
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', previousMessage.message_id)
      .eq('chat_id', message.chat.id)
      .single();
  
    if (existingMessage) {
      // Store previous state in edit_history
      let editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_caption: existingMessage.caption,
        new_caption: message.caption,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        previous_analyzed_content: existingMessage.analyzed_content
      });
      
      // Extract the media from the message (photo, video, or document)
      const mediaContent = message.photo ? 
        message.photo[message.photo.length - 1] : 
        message.video || message.document;
      
      // Check if caption changed
      const captionChanged = message.caption !== existingMessage.caption;
      // Check if media changed
      const mediaChanged = mediaContent && 
                           mediaContent.file_unique_id !== existingMessage.file_unique_id;
      
      // If media changed, we need to process the new media
      let mediaInfo: {
        file_id: string;
        file_unique_id: string;
        mime_type: string;
        mime_type_original?: string;
        storage_path?: string;
        public_url?: string;
        width?: number;
        height?: number;
        duration?: number;
        file_size: number;
      } | null = null;
      
      if (mediaChanged && TELEGRAM_BOT_TOKEN) {
        console.log(`[${correlationId}] Media changed in edited message ${message.message_id}, processing new media`);
        
        // Detect MIME type from the complete message to ensure accuracy
        const detectedMimeType = detectMimeType(message);
        console.log(`[${correlationId}] Detected MIME type for edited message: ${detectedMimeType}`);
        
        // Use improved media download with better metadata handling
        const downloadResult = await downloadMediaFromTelegram(
          mediaContent.file_id,
          mediaContent.file_unique_id,
          detectedMimeType,
          TELEGRAM_BOT_TOKEN
        );
        
        if (!downloadResult.success || !downloadResult.blob) {
          throw new Error(`Failed to download edited media: ${downloadResult.error}`);
        }
        
        // Upload to storage with standardized path
        const uploadResult = await uploadMediaToStorage(
          downloadResult.storagePath || `${mediaContent.file_unique_id}.bin`,
          downloadResult.blob,
          downloadResult.mimeType || detectedMimeType,
          existingMessage.id
        );
        
        if (!uploadResult.success) {
          throw new Error(`Failed to upload edited media: ${uploadResult.error}`);
        }
        
        mediaInfo = {
          file_id: mediaContent.file_id,
          file_unique_id: mediaContent.file_unique_id,
          mime_type: downloadResult.mimeType || detectedMimeType,
          mime_type_original: message.document?.mime_type || message.video?.mime_type,
          storage_path: downloadResult.storagePath,
          public_url: uploadResult.publicUrl,
          width: mediaContent.width,
          height: mediaContent.height,
          duration: message.video?.duration,
          file_size: downloadResult.blob.size
        };
      }
      
      // Prepare update data
      const updateData: Record<string, any> = {
        caption: message.caption,
        telegram_data: message,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        is_edited: true,
        correlation_id: correlationId,
        updated_at: new Date().toISOString(),
        // Reset processing state if caption changed
        processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
        // Reset analyzed content if caption changed
        analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
        // Mark as needing group sync if caption changed and part of a group
        group_caption_synced: captionChanged && message.media_group_id ? false : existingMessage.group_caption_synced,
        // Set is_original_caption to false if caption was removed
        is_original_caption: captionChanged && !message.caption ? false : existingMessage.is_original_caption
      };
      
      // If media changed, update media-related fields
      if (mediaChanged && mediaInfo) {
        Object.assign(updateData, {
          file_id: mediaInfo.file_id,
          file_unique_id: mediaInfo.file_unique_id,
          mime_type: mediaInfo.mime_type,
          mime_type_original: mediaInfo.mime_type_original,
          storage_path: mediaInfo.storage_path,
          public_url: mediaInfo.public_url,
          width: mediaInfo.width,
          height: mediaInfo.height,
          duration: mediaInfo.duration,
          file_size: mediaInfo.file_size,
          storage_exists: true,
          storage_path_standardized: true,
          needs_redownload: false
        });
      }
      
      // Update the message
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', existingMessage.id);
  
      if (updateError) throw updateError;
  
      // If caption changed and has content, trigger caption analysis
      if (captionChanged && message.caption) {
        await processCaptionChanges(
          existingMessage.id,
          message.caption,
          message.media_group_id,
          correlationId,
          true // isEdit
        );
      } 
      // If caption was removed, check if this is part of a media group and needs syncing
      else if (captionChanged && !message.caption && message.media_group_id) {
        await handleRemovedCaption(
          existingMessage.id,
          message.media_group_id,
          correlationId
        );
      }
  
      // Log the edit event
      try {
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: 'message_edited',
          entity_id: existingMessage.id,
          metadata: {
            message_id: message.message_id,
            chat_id: message.chat.id,
            file_unique_id: mediaChanged && mediaInfo ? mediaInfo.file_unique_id : existingMessage.file_unique_id,
            existing_message_id: existingMessage.id,
            edit_type: mediaChanged ? 'media_changed' : (captionChanged ? 'caption_changed' : 'other_edit'),
            media_group_id: message.media_group_id
          },
          correlation_id: context.correlationId
        });
      } catch (logError) {
        console.error('Error logging edit operation:', logError);
      }
  
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If existing message not found, handle as new message
    return await handleNewMediaMessage(message, context);
  }
  
  /**
   * Handle new media messages
   */
  async function handleNewMediaMessage(
    message: TelegramMessage, 
    context: MessageContext
  ): Promise<Response> {
    const { correlationId } = context;
    
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN, cannot process media');
    }
  
    // Extract the media from the message (photo, video, or document)
    const mediaContent = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
      
    if (!mediaContent) {
      throw new Error('No media content found in message');
    }
  
    // Check for duplicate message by file_unique_id
    const existingMedia = await checkDuplicateFile(mediaContent.file_unique_id);
  
    // If file already exists, update instead of creating new record
    if (existingMedia) {
      console.log(`[${correlationId}] Duplicate message detected with file_unique_id ${mediaContent.file_unique_id}, updating existing record`);
      
      // Check if caption changed
      const captionChanged = message.caption !== existingMedia.caption;
      
      // Update the existing message
      const updateData: Record<string, any> = {
        caption: message.caption,
        chat_id: message.chat.id,
        chat_title: message.chat.title,
        chat_type: message.chat.type,
        telegram_message_id: message.message_id,
        telegram_data: message,
        correlation_id: correlationId,
        media_group_id: message.media_group_id,
        // Preserve existing storage path
        storage_path: existingMedia.storage_path,
        // Use existing public_url - it's generated by Supabase
        public_url: existingMedia.public_url,
        // Reset processing if caption changed
        processing_state: captionChanged ? 'pending' : existingMedia.processing_state,
        analyzed_content: captionChanged ? null : existingMedia.analyzed_content,
        updated_at: new Date().toISOString(),
        is_duplicate: true,
        duplicate_reference_id: existingMedia.id,
        // Clear any error state on successful update
        error_message: null,
        error_code: null
      };
  
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', existingMedia.id);
  
      if (updateError) {
        console.error(`[${correlationId}] Error updating existing message:`, updateError);
        throw updateError;
      }
  
      // Log the duplicate detection
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'duplicate_file_detected',
        entity_id: existingMedia.id,
        metadata: {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaContent.file_unique_id,
          media_group_id: message.media_group_id,
          update_type: 'duplicate_update'
        },
        correlation_id: correlationId
      });
  
      // Process caption if it changed
      if (captionChanged && message.caption) {
        await processCaptionChanges(
          existingMedia.id,
          message.caption,
          message.media_group_id,
          correlationId,
          false // Not an edit
        );
      } else if (message.media_group_id) {
        // Check if we need to sync with media group
        await checkMediaGroupSync(
          existingMedia.id,
          message.media_group_id,
          correlationId
        );
      }
  
      return new Response(
        JSON.stringify({ success: true, duplicate: true, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  
    // Process media for new message
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    // Detect MIME type from the complete message
    const detectedMimeType = detectMimeType(message);
    console.log(`[${correlationId}] Detected MIME type: ${detectedMimeType} for new message ${message.message_id}`);
    
    // Download the file
    const downloadResult = await downloadMediaFromTelegram(
      telegramFile.file_id,
      telegramFile.file_unique_id,
      detectedMimeType,
      TELEGRAM_BOT_TOKEN
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(`Failed to download file from Telegram: ${downloadResult.error || 'Unknown error'}`);
    }
    
    // Upload to Supabase Storage
    const uploadResult = await uploadMediaToStorage(
      downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
      downloadResult.blob,
      downloadResult.mimeType || detectedMimeType
    );
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload file to Supabase Storage: ${uploadResult.error || 'Unknown error'}`);
    }
  
    // Prepare forward info if message is forwarded
    const forwardInfo: ForwardInfo | undefined = message.forward_origin ? {
      is_forwarded: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_chat_type: message.forward_origin.chat?.type,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
      original_chat_id: message.forward_origin.chat?.id,
      original_chat_title: message.forward_origin.chat?.title,
      original_message_id: message.forward_origin.message_id
    } : undefined;
  
    // Create message input using the downloaded media info
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: downloadResult.mimeType || detectedMimeType,
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
      storage_path: downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
      public_url: uploadResult.publicUrl,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size || downloadResult.blob.size,
      correlation_id: context.correlationId,
      processing_state: message.caption ? 'pending' : 'initialized',
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
      is_forward: context.isForwarded,
      edit_history: context.isEdit ? [{
        timestamp: new Date().toISOString(),
        is_initial_edit: true,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      }] : [],
      storage_exists: true,
      storage_path_standardized: true
    };
  
    // Create the message record
    const result = await createMessage(messageInput);
  
    if (!result.success) {
      console.error(`[${correlationId}] Error creating message:`, result.error_message);
      throw new Error(result.error_message || 'Failed to create message');
    }
  
    // Log the insert event
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'message_created',
        entity_id: result.id,
        metadata: {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: telegramFile.file_unique_id,
          media_group_id: message.media_group_id,
          is_forwarded: !!messageInput.forward_info,
          storage_path: downloadResult.storagePath,
          mime_type: downloadResult.mimeType || detectedMimeType,
          document_mime_type: message.document?.mime_type,
          video_mime_type: message.video?.mime_type
        },
        correlation_id: correlationId
      });
    } catch (logError) {
      console.error(`[${correlationId}] Error logging message creation:`, logError);
    }
  
    // Process caption or check media group sync
    if (message.caption) {
      await processCaptionChanges(
        result.id,
        message.caption,
        message.media_group_id,
        correlationId,
        false // Not an edit
      );
    } else if (message.media_group_id) {
      // Check if we need to sync with media group
      await checkMediaGroupSync(
        result.id,
        message.media_group_id,
        correlationId
      );
    }
  
    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  /**
   * Main handler for media messages from Telegram
   */
  async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
    try {
      const { correlationId, isEdit, previousMessage } = context;
      
      // Log the start of processing
      console.log(`[${correlationId}] Processing ${isEdit ? 'edited' : 'new'} media message ${message.message_id} in chat ${message.chat.id}`);
      
      // Determine if this is an edited message or a new message
      if (isEdit && previousMessage) {
        return await handleEditedMediaMessage(message, context, previousMessage);
      }
  
      // Handle new message
      return await handleNewMediaMessage(message, context);
    } catch (error) {
      console.error(`[${context.correlationId}] Error handling media message:`, error);
      
      // Log error event
      try {
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: 'message_processing_failed',
          error_message: error.message || 'Unknown error in media message handler',
          metadata: {
            message_id: message.message_id,
            chat_id: message.chat?.id,
            processing_stage: 'media_handling',
            error_code: error.code,
            handler_type: 'media_message'
          },
          correlation_id: context.correlationId
        });
      } catch (logError) {
        console.error(`[${context.correlationId}] Failed to log error:`, logError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: error.message,
          correlationId: context.correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
  
  // ============================================================================
  // Edge Function Entry Point
  // ============================================================================
  
  // Handle incoming requests
  Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    
    try {
      // Only accept POST requests
      if (req.method !== 'POST') {
        throw new Error(`Method ${req.method} not allowed`);
      }
      
      // Parse request body
      const requestData = await req.json();
      
      // Generate correlation ID
      const correlationId = crypto.randomUUID();
      
      // Extract message from Telegram update
      const message = requestData.message || requestData.edited_message || requestData.channel_post || requestData.edited_channel_post;
      
      if (!message) {
        throw new Error('No message found in request');
      }
      
      // Set up context
      const context: MessageContext = {
        correlationId,
        isEdit: !!requestData.edited_message || !!requestData.edited_channel_post,
        previousMessage: requestData.edited_message || requestData.edited_channel_post,
        isChannelPost: !!requestData.channel_post || !!requestData.edited_channel_post,
        isForwarded: !!message.forward_origin
      };
      
      // Skip messages without media
      if (!message.photo && !message.video && !message.document) {
        return new Response(
          JSON.stringify({ success: true, message: 'Skipped non-media message', correlationId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Process media message
      return await handleMediaMessage(message, context);
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      return new Response(
        JSON.stringify({ 
          error: error.message,
          timestamp: new Date().toISOString() 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });

<<<<<<< HEAD
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders, handleOptionsRequest, createCorsResponse } from '../../_shared/cors.ts';
=======
import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
>>>>>>> newmai
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_validateAndFixStoragePath,
  xdelo_isViewableMimeType,
  xdelo_detectMimeType
} from '../../_shared/mediaUtils.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { createMessage, checkDuplicateFile } from '../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../_shared/messageUtils.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

/**
 * Main handler for media messages from Telegram
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage } = context;
    
    // Log the start of processing
    console.log(`[${correlationId}] Processing ${isEdit ? 'edited' : 'new'} media message ${message.message_id} in chat ${message.chat.id}`);
    
    // Validate the message structure
    if (!message || !message.chat) {
      throw new Error(`Invalid message structure: ${JSON.stringify(message, null, 2)}`);
    }
    
    // Determine if this is an edited message or a new message
    if (isEdit && previousMessage) {
      return await xdelo_handleEditedMediaMessage(message, context, previousMessage);
    }

    // Handle new message
    return await xdelo_handleNewMediaMessage(message, context);
  } catch (error) {
    // Improved error handling with better stringification
    const errorMessage = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[${context.correlationId}] Error handling media message:`, errorMessage);
    if (errorStack) {
      console.error(`[${context.correlationId}] Error stack:`, errorStack);
    }
    
    // Log full error object structure for debugging
    if (typeof error === 'object') {
      console.error(`[${context.correlationId}] Error object keys:`, Object.keys(error));
    }
    
    // Log error event with structured data
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'message_processing_failed',
        entity_id: crypto.randomUUID(), // Generate a fallback ID
        error_message: errorMessage,
        metadata: {
          message_id: message?.message_id,
          chat_id: message?.chat?.id,
          processing_stage: 'media_handling',
          error_code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
          error_stack: errorStack,
          error_object: typeof error === 'object' ? JSON.stringify(error) : undefined,
          handler_type: 'media_message',
          timestamp: new Date().toISOString()
        },
        correlation_id: context.correlationId
      });
    } catch (logError) {
      console.error(`[${context.correlationId}] Failed to log error:`, 
        logError instanceof Error ? logError.message : String(logError));
    }
    
<<<<<<< HEAD
    return createCorsResponse({ 
      error: error.message,
      correlationId: context.correlationId 
    }, { status: 500 });
=======
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlationId: context.correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
>>>>>>> newmai
  }
}

/**
 * Handle edited media messages with improved storage path handling
 */
async function xdelo_handleEditedMediaMessage(
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
    const editHistory = existingMessage.edit_history || [];
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
    let mediaInfo = null;
    if (mediaChanged && TELEGRAM_BOT_TOKEN) {
      console.log(`[${correlationId}] Media changed in edited message ${message.message_id}, processing new media`);
      
      // Detect MIME type from the complete message to ensure accuracy
      const detectedMimeType = xdelo_detectMimeType(message);
      console.log(`[${correlationId}] Detected MIME type for edited message: ${detectedMimeType}`);
      
      // Use improved media download with better metadata handling
      const downloadResult = await xdelo_downloadMediaFromTelegram(
        mediaContent.file_id,
        mediaContent.file_unique_id,
        detectedMimeType,
        TELEGRAM_BOT_TOKEN
      );
      
      if (!downloadResult.success || !downloadResult.blob) {
        throw new Error(`Failed to download edited media: ${downloadResult.error}`);
      }
      
      // Upload to storage with standardized path
      const uploadResult = await xdelo_uploadMediaToStorage(
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
      await xdelo_processCaptionChanges(
        existingMessage.id,
        message.caption,
        message.media_group_id,
        correlationId,
        true // isEdit
      );
    } 
    // If caption was removed, check if this is part of a media group and needs syncing
    else if (captionChanged && !message.caption && message.media_group_id) {
      await xdelo_handleRemovedCaption(
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

    return createCorsResponse({ success: true });
  }
  
  // If existing message not found, handle as new message
  return await xdelo_handleNewMediaMessage(message, context);
}

/**
 * Handle new media messages with improved storage path handling
 */
async function xdelo_handleNewMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN, cannot process media');
  }

  // Validate message has required fields
  if (!message.chat?.id) {
    throw new Error(`Missing chat ID in message: ${JSON.stringify(message)}`);
  }

  // Extract the media from the message (photo, video, or document)
  const mediaContent = message.photo ? 
    message.photo[message.photo.length - 1] : 
    message.video || message.document;
    
  if (!mediaContent) {
    throw new Error(`No media content found in message: ${JSON.stringify(message)}`);
  }

  if (!mediaContent.file_unique_id) {
    throw new Error(`Missing file_unique_id in mediaContent: ${JSON.stringify(mediaContent)}`);
  }

  try {
    // Check for duplicate message by file_unique_id
    const existingMedia = await checkDuplicateFile(supabaseClient, mediaContent.file_unique_id);

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
        await xdelo_processCaptionChanges(
          existingMedia.id,
          message.caption,
          message.media_group_id,
          correlationId,
          false // Not an edit
        );
      } else if (message.media_group_id) {
        // Check if we need to sync with media group
        await xdelo_checkMediaGroupSync(
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

    // Process media for new message with improved approach
    const telegramFile = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    if (!telegramFile) {
      throw new Error(`Failed to extract telegram file from message: ${JSON.stringify(message)}`);
    }
    
    if (!telegramFile.file_id) {
      throw new Error(`Missing file_id in telegram file: ${JSON.stringify(telegramFile)}`);
    }
    
    // Detect MIME type from the complete message
    const detectedMimeType = xdelo_detectMimeType(message);
    console.log(`[${correlationId}] Detected MIME type: ${detectedMimeType} for new message ${message.message_id}`);
    
    // Download the file with improved metadata handling
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      telegramFile.file_id,
      telegramFile.file_unique_id,
      detectedMimeType,
      TELEGRAM_BOT_TOKEN
    );
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(`Failed to download file from Telegram: ${downloadResult.error || 'Unknown error'}`);
    }
    
    // Upload to Supabase Storage with standardized path
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
      downloadResult.blob,
      downloadResult.mimeType || detectedMimeType,
      // No message ID yet since we haven't created it
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
      storage_exists: true, // We just uploaded it
      storage_path_standardized: true, // We're using our standardized paths
      message_url: constructTelegramMessageUrl(message) // Add message URL using the utility function
    };

    // Create the message record
    const logger = {
      error: (msg: string, error: unknown) => {
        const errorStr = error instanceof Error ? 
          `${error.message} (${error.stack})` : 
          (typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error));
        console.error(`[${correlationId}] ${msg}`, errorStr);
      },
      info: (msg: string, data?: unknown) => console.log(`[${correlationId}] ${msg}`, data)
    };
    
    // Create the message with improved logging
    console.log(`[${correlationId}] Creating message with input:`, JSON.stringify({
      telegram_message_id: messageInput.telegram_message_id,
      chat_id: messageInput.chat_id,
      file_unique_id: messageInput.file_unique_id,
      media_group_id: messageInput.media_group_id,
      mime_type: messageInput.mime_type,
      storage_path: messageInput.storage_path,
      public_url: messageInput.public_url?.substring(0, 50) + '...' // Truncate for log readability
    }));
    
    const result = await createMessage(supabaseClient, messageInput, logger);

    if (!result.success) {
      console.error(`[${correlationId}] Error creating message:`, result.error_message);
      
      // Additional diagnostic info about the failed message
      console.error(`[${correlationId}] Message creation diagnostic details:`, {
        telegram_message_id: messageInput.telegram_message_id,
        chat_id: messageInput.chat_id,
        file_unique_id: messageInput.file_unique_id,
        storage_path: messageInput.storage_path,
        public_url_exists: !!messageInput.public_url,
        error_message: result.error_message,
        error_code: result.error_code
      });
      
      throw new Error(`Failed to create message: ${result.error_message || 'Unknown error'}`);
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
      await xdelo_processCaptionChanges(
        result.id,
        message.caption,
        message.media_group_id,
        correlationId,
        false // Not an edit
      );
    } else if (message.media_group_id) {
      // Check if we need to sync with media group
      await xdelo_checkMediaGroupSync(
        result.id,
        message.media_group_id,
        correlationId
      );
    }

<<<<<<< HEAD
    return createCorsResponse({ success: true, duplicate: true, correlationId });
  }

  // Process media for new message with improved approach
  const telegramFile = message.photo ? 
    message.photo[message.photo.length - 1] : 
    message.video || message.document;
  
  // Detect MIME type from the complete message
  const detectedMimeType = xdelo_detectMimeType(message);
  console.log(`[${correlationId}] Detected MIME type: ${detectedMimeType} for new message ${message.message_id}`);
  
  // Download the file with improved metadata handling
  const downloadResult = await xdelo_downloadMediaFromTelegram(
    telegramFile.file_id,
    telegramFile.file_unique_id,
    detectedMimeType,
    TELEGRAM_BOT_TOKEN
  );
  
  if (!downloadResult.success || !downloadResult.blob) {
    throw new Error(`Failed to download file from Telegram: ${downloadResult.error || 'Unknown error'}`);
  }
  
  // Upload to Supabase Storage with standardized path
  const uploadResult = await xdelo_uploadMediaToStorage(
    downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
    downloadResult.blob,
    downloadResult.mimeType || detectedMimeType,
    // No message ID yet since we haven't created it
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
    storage_exists: true, // We just uploaded it
    storage_path_standardized: true // We're using our standardized paths
  };

  // Create the message record
  const logger = {
    error: (msg: string, error: unknown) => console.error(`[${correlationId}] ${msg}`, error),
    info: (msg: string, data?: unknown) => console.log(`[${correlationId}] ${msg}`, data)
  };
  
  const result = await createMessage(supabaseClient, messageInput, logger);

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
=======
    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (createError) {
    // Enhanced error handling
    const errorMessage = createError instanceof Error 
      ? createError.message 
      : (typeof createError === 'object' ? JSON.stringify(createError) : String(createError));
    
    const errorStack = createError instanceof Error ? createError.stack : undefined;
    
    console.error(`[${correlationId}] Error in xdelo_handleNewMediaMessage:`, errorMessage);
    if (errorStack) {
      console.error(`[${correlationId}] Error stack:`, errorStack);
    }
    
    // Full diagnostic information for debugging
    console.error(`[${correlationId}] Error context:`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat?.id,
      file_unique_id: mediaContent.file_unique_id,
      media_group_id: message.media_group_id,
      error_type: typeof createError,
      error_keys: typeof createError === 'object' ? Object.keys(createError) : 'N/A'
>>>>>>> newmai
    });
    
    // Log detailed error to database
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'media_message_creation_failed',
        entity_id: crypto.randomUUID(),
        error_message: errorMessage,
        metadata: {
          telegram_message_id: message.message_id,
          chat_id: message.chat?.id,
          file_unique_id: mediaContent.file_unique_id,
          media_group_id: message.media_group_id,
          error_stack: errorStack,
          correlation_id
        },
        correlation_id
      });
    } catch (logError) {
      console.error(`[${correlationId}] Failed to log media creation error:`, logError);
    }
    
    // Re-throw to be caught by the main handler
    throw createError;
  }
<<<<<<< HEAD

  // Process caption or check media group sync
  if (message.caption) {
    await xdelo_processCaptionChanges(
      result.id,
      message.caption,
      message.media_group_id,
      correlationId,
      false // Not an edit
    );
  } else if (message.media_group_id) {
    // Check if we need to sync with media group
    await xdelo_checkMediaGroupSync(
      result.id,
      message.media_group_id,
      correlationId
    );
  }

  return createCorsResponse({ success: true, id: result.id, correlationId });
=======
>>>>>>> newmai
}

/**
 * Process caption changes
 */
async function xdelo_processCaptionChanges(
  messageId: string,
  caption: string,
  mediaGroupId: string | undefined,
  correlationId: string,
  isEdit: boolean
): Promise<void> {
  console.log(`[${correlationId}] Processing caption for message ${messageId}`);
  
  try {
    // Use direct caption processor with manual-caption-parser
    const captionProcessorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/manual-caption-parser`;
    const processorResponse = await fetch(captionProcessorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
async function xdelo_handleRemovedCaption(
  messageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<void> {
  try {
    console.log(`[${correlationId}] Caption removed, checking for media group sync from group ${mediaGroupId}`);
    
    // Replace RPC call with direct query to find messages in the same media group
    const { data: groupMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select('id, caption, analyzed_content')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (queryError) {
      console.error(`[${correlationId}] Error querying media group messages:`, queryError);
      return;
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      console.log(`[${correlationId}] No messages found in media group ${mediaGroupId}`);
      return;
    }
    
    // Find if any message in the group has analyzed content to sync
    const messageWithContent = groupMessages.find(msg => 
      msg.id !== messageId && 
      msg.caption && 
      msg.analyzed_content
    );
    
    if (!messageWithContent) {
      console.log(`[${correlationId}] No analyzed content found in media group ${mediaGroupId} to sync`);
      return;
    }
    
    // Sync the analyzed content to our message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: messageWithContent.analyzed_content,
        group_caption_synced: true,
        is_original_caption: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      console.error(`[${correlationId}] Error updating message with synced content:`, updateError);
      return;
    }
    
    console.log(`[${correlationId}] Successfully synced content from message ${messageWithContent.id} to message ${messageId}`);
    
    // Log the sync operation
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_synced',
      entity_id: messageId,
      metadata: {
        media_group_id: mediaGroupId,
        source_message_id: messageWithContent.id,
        operation: 'caption_removal_sync'
      },
      correlation_id: correlationId
    });
    
  } catch (error) {
    console.error(`[${correlationId}] Failed to sync with media group after caption removal:`, error);
  }
}

/**
 * Check if we need to sync with media group
 */
async function xdelo_checkMediaGroupSync(
  messageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<void> {
  try {
    console.log(`[${correlationId}] Message ${messageId} has no caption but is part of media group ${mediaGroupId}, checking for content`);
    
    // Replace RPC call with direct query to find messages in the same media group
    const { data: groupMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select('id, caption, analyzed_content, created_at')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (queryError) {
      console.error(`[${correlationId}] Error querying media group messages:`, queryError);
      return;
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      console.log(`[${correlationId}] No messages found in media group ${mediaGroupId}`);
      return;
    }
    
    // Find if any message in the group has analyzed content to sync
    const messageWithContent = groupMessages.find(msg => 
      msg.id !== messageId && 
      msg.caption && 
      msg.analyzed_content
    );
    
    if (!messageWithContent) {
      console.log(`[${correlationId}] No analyzed content found in media group ${mediaGroupId} to sync. Scheduling a delayed re-check.`);
      
      // If no content to sync, set a delayed re-check
      setTimeout(async () => {
        try {
          console.log(`[${correlationId}] Performing delayed re-check for message ${messageId} in group ${mediaGroupId}`);
          
          // Re-query for messages in case they've been updated
          const { data: refreshedMessages, error: refreshError } = await supabaseClient
            .from('messages')
            .select('id, caption, analyzed_content')
            .eq('media_group_id', mediaGroupId)
            .order('created_at', { ascending: true });
            
          if (refreshError || !refreshedMessages || refreshedMessages.length === 0) {
            console.log(`[${correlationId}] Still no messages found in delayed re-check for group ${mediaGroupId}`);
            return;
          }
          
          const refreshedSourceMsg = refreshedMessages.find(msg => 
            msg.id !== messageId && 
            msg.caption && 
            msg.analyzed_content
          );
          
          if (!refreshedSourceMsg) {
            console.log(`[${correlationId}] No content found in delayed re-check for group ${mediaGroupId}`);
            return;
          }
          
          // Sync the analyzed content to our message
          const { error: updateError } = await supabaseClient
            .from('messages')
            .update({
              analyzed_content: refreshedSourceMsg.analyzed_content,
              group_caption_synced: true,
              is_original_caption: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
            
          if (updateError) {
            console.error(`[${correlationId}] Error updating message in delayed re-check:`, updateError);
            return;
          }
          
          console.log(`[${correlationId}] Successfully synced content in delayed re-check from message ${refreshedSourceMsg.id} to message ${messageId}`);
          
        } catch (delayedError) {
          console.error(`[${correlationId}] Delayed media group check failed:`, delayedError);
        }
      }, 10000); // 10 second delay
      
      return;
    }
    
    // Sync the analyzed content to our message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: messageWithContent.analyzed_content,
        group_caption_synced: true,
        is_original_caption: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      console.error(`[${correlationId}] Error updating message with synced content:`, updateError);
      return;
    }
    
    console.log(`[${correlationId}] Successfully synced content from message ${messageWithContent.id} to message ${messageId}`);
    
    // Log the sync operation
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_synced',
      entity_id: messageId,
      metadata: {
        media_group_id: mediaGroupId,
        source_message_id: messageWithContent.id,
        operation: 'initial_sync'
      },
      correlation_id: correlationId
    });
    
  } catch (error) {
    console.error(`[${correlationId}] Failed to check media group sync:`, error);
  }
}


import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { xdelo_analyzeMessageCaption } from '../../_shared/databaseOperations.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_validateAndFixStoragePath,
  xdelo_isViewableMimeType,
  xdelo_detectMimeType
} from '../../_shared/mediaUtils.ts';
import {
  xdelo_findExistingFile,
  xdelo_processMessageMedia
} from '../../_shared/mediaStorage.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { createMessage, checkDuplicateFile } from '../dbOperations.ts';

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
    
    // Determine if this is an edited message or a new message
    if (isEdit && previousMessage) {
      return await xdelo_handleEditedMediaMessage(message, context, previousMessage);
    }

    // Handle new message
    return await xdelo_handleNewMediaMessage(message, context);
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

/**
 * Handle edited media messages
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
    let mediaInfo = null;
    if (mediaChanged && TELEGRAM_BOT_TOKEN) {
      console.log(`[${correlationId}] Media changed in edited message ${message.message_id}, processing new media`);
      
      // Use our shared utility to process the media
      const processResult = await xdelo_processMessageMedia(
        supabaseClient,
        message,
        mediaContent.file_id,
        mediaContent.file_unique_id,
        TELEGRAM_BOT_TOKEN,
        existingMessage.id
      );
      
      if (!processResult.success) {
        throw new Error(`Failed to process edited media: ${processResult.error}`);
      }
      
      mediaInfo = processResult.fileInfo;
    }
    
    // Prepare update data
    const updateData: Record<string, any> = {
      caption: message.caption,
      telegram_data: message,
      edit_date: new Date(message.edit_date * 1000).toISOString(),
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If existing message not found, handle as new message
  return await xdelo_handleNewMediaMessage(message, context);
}

/**
 * Handle new media messages
 */
async function xdelo_handleNewMediaMessage(
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

  // Process media for new message using our improved function
  const telegramFile = message.photo ? 
    message.photo[message.photo.length - 1] : 
    message.video || message.document;
  
  // Extract original filename if available
  const originalFilename = message.document?.file_name || message.video?.file_name;
  
  // Get original MIME type from Telegram
  const originalMimeType = message.document?.mime_type || message.video?.mime_type;
  
  // Download the file from Telegram with improved handling
  const downloadResult = await xdelo_downloadMediaFromTelegram(
    telegramFile.file_id,
    telegramFile.file_unique_id,
    originalMimeType || 'application/octet-stream',
    TELEGRAM_BOT_TOKEN
  );
  
  if (!downloadResult.success || !downloadResult.blob) {
    throw new Error(`Failed to download file from Telegram: ${downloadResult.error || 'Unknown error'}`);
  }
  
  // Upload to Supabase Storage with improved handling
  const uploadResult = await xdelo_uploadMediaToStorage(
    downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
    downloadResult.blob,
    downloadResult.mimeType || originalMimeType || 'application/octet-stream'
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
    mime_type: downloadResult.mimeType || originalMimeType || 'application/octet-stream',
    mime_type_original: originalMimeType,
    storage_path: downloadResult.storagePath || `${telegramFile.file_unique_id}.bin`,
    public_url: uploadResult.publicUrl, // Use the URL returned by Supabase
    width: telegramFile.width,
    height: telegramFile.height,
    duration: message.video?.duration,
    file_size: telegramFile.file_size,
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
        is_forwarded: !!messageInput.forward_info
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

  return new Response(
    JSON.stringify({ success: true, id: result.id, correlationId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
    // First try direct caption processor with manual-caption-parser
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
    console.error(`[${correlationId}] Manual caption processor failed, falling back to database function:`, directError);
    
    // Fallback: Call the database function
    try {
      const captionResult = await xdelo_analyzeMessageCaption(
        messageId,
        correlationId,
        caption,
        mediaGroupId,
        isEdit // Force reprocess for edits
      );
      
      if (!captionResult.success) {
        console.error(`[${correlationId}] Database caption processing failed:`, captionResult.error);
      }
    } catch (dbError) {
      console.error(`[${correlationId}] All caption processing attempts failed:`, dbError);
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
async function xdelo_checkMediaGroupSync(
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

/// <reference types="https://deno.land/std@0.168.0/http/server.ts" />
/// <reference types="https://esm.sh/@supabase/supabase-js@2" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, formatErrorResponse, formatSuccessResponse, checkMessageExists, supabase, logEvent } from "../_shared/core.ts";
import { xdelo_processMessageMedia, xdelo_findMediaGroupMessages } from "../_shared/media.ts";
import { MessageContext, MessageInput, TelegramMessage, MediaResult, MediaInfo } from "../_shared/types.ts";

// Constants
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

/**
 * Check if a file already exists in storage
 */
async function checkDuplicateFile(fileUniqueId: string): Promise<boolean> {
  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('file_unique_id', fileUniqueId)
    .single();
  return !!data;
}

/**
 * Process caption changes for a message
 */
async function processCaptionChanges(
  messageId: string,
  caption: string,
  mediaGroupId: string | undefined,
  correlationId: string,
  isEdit: boolean
): Promise<void> {
  // Mark message for processing
  await supabase
    .from('messages')
    .update({ 
      processing_state: 'pending',
      caption,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId);
}

function getMediaInfo(message: TelegramMessage): MediaInfo | null {
  if (message.photo && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1]
    return {
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size
    }
  }
  if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      mime_type: message.video.mime_type,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      file_size: message.video.file_size
    }
  }
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type,
      file_size: message.document.file_size,
      file_name: message.document.file_name
    }
  }
  return null
}

/**
 * Enhanced audit logging function that follows our documentation
 */
async function logMessageEvent(
  eventType: string,
  entityId: string,
  context: {
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    metadata?: Record<string, any>;
    errorMessage?: string;
    correlationId: string;
    telegramMessageId?: number;
    chatId?: number;
  }
): Promise<void> {
  const {
    previousState,
    newState,
    metadata,
    errorMessage,
    correlationId,
    telegramMessageId,
    chatId
  } = context;

  await supabase.from('unified_audit_logs').insert({
    event_type: eventType,
    entity_id: entityId,
    telegram_message_id: telegramMessageId,
    chat_id: chatId,
    previous_state: previousState,
    new_state: newState,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      logged_from: 'telegram-webhook'
    },
    error_message: errorMessage,
    correlation_id: correlationId
  });
}

/**
 * Handle edited media messages
 */
async function handleEditedMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  previousMessage: TelegramMessage
): Promise<MediaResult> {
  const { correlationId } = context;

  // Find existing message
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('*')
    .eq('telegram_message_id', previousMessage.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (!existingMessage) {
    return { success: false, error: 'Message not found' };
  }

  // Store previous state in edit_history
  let editHistory = existingMessage.edit_history || [];
  editHistory.push({
    timestamp: new Date().toISOString(),
    previous_caption: existingMessage.caption,
    new_caption: message.caption,
    edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
    previous_analyzed_content: existingMessage.analyzed_content
  });

  // Extract media content
  const mediaContent = message.photo ? 
    message.photo[message.photo.length - 1] : 
    message.video || message.document;

  // Check for changes
  const captionChanged = message.caption !== existingMessage.caption;
  const mediaChanged = mediaContent && mediaContent.file_unique_id !== existingMessage.file_unique_id;

  // Process new media if changed
  let mediaInfo = null;
  if (mediaChanged && TELEGRAM_BOT_TOKEN) {
    const mediaResult = await xdelo_processMessageMedia(
      message,
      mediaContent.file_id,
      mediaContent.file_unique_id,
      TELEGRAM_BOT_TOKEN,
      existingMessage.id
    );

    if (!mediaResult.success) {
      throw new Error(`Failed to process edited media: ${mediaResult.error}`);
    }

    mediaInfo = mediaResult.fileInfo;
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
    processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
    analyzed_content: captionChanged ? null : existingMessage.analyzed_content
  };

  // Update media-related fields if changed
  if (mediaChanged && mediaInfo) {
    Object.assign(updateData, {
      file_id: mediaContent.file_id,
      file_unique_id: mediaContent.file_unique_id,
      mime_type: mediaInfo.mime_type || 'application/octet-stream',
      storage_path: mediaInfo.storage_path,
      public_url: mediaInfo.public_url,
      width: mediaContent.width || undefined,
      height: mediaContent.height || undefined,
      duration: message.video?.duration,
      file_size: mediaInfo.file_size || undefined,
      storage_exists: true,
      storage_path_standardized: true
    });
  }

  // Update the message
  const { error: updateError } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', existingMessage.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log the edit
  const previousState = {
    caption: existingMessage.caption,
    analyzed_content: existingMessage.analyzed_content,
    file_unique_id: existingMessage.file_unique_id
  };

  await logMessageEvent('message_edited', existingMessage.id, {
    previousState,
    newState: updateData,
    metadata: {
      message_id: message.message_id,
      chat_id: message.chat.id,
      edit_type: mediaChanged ? 'media_changed' : (captionChanged ? 'caption_changed' : 'other_edit'),
      media_group_id: message.media_group_id
    },
    correlationId,
    telegramMessageId: message.message_id,
    chatId: message.chat.id
  });

  return {
    success: true,
    fileInfo: {
      mime_type: existingMessage.mime_type,
      storage_path: existingMessage.storage_path,
      public_url: existingMessage.public_url,
      file_size: existingMessage.file_size
    }
  };
}

/**
 * Process media message following documented flow
 */
async function processMediaMessage(
  message: TelegramMessage,
  mediaContent: any,
  correlationId: string
): Promise<MediaResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN, cannot process media');
  }

  // 1. Check for duplicates
  const isDuplicate = await checkDuplicateFile(mediaContent.file_unique_id);
  if (isDuplicate) {
    await logMessageEvent('duplicate_media_detected', message.message_id.toString(), {
      correlationId,
      metadata: { file_unique_id: mediaContent.file_unique_id },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    return { success: false, error: 'Duplicate media detected' };
  }

  // 2. Get message URL
  const messageUrl = `https://t.me/c/${message.chat.id}/${message.message_id}`;

  // 3. Process media file
  const mediaResult = await xdelo_processMessageMedia(
    message,
    mediaContent.file_id,
    mediaContent.file_unique_id,
    TELEGRAM_BOT_TOKEN,
    undefined // message ID will be set after creation
  );

  if (!mediaResult.success) {
    await logMessageEvent('media_processing_failed', message.message_id.toString(), {
      correlationId,
      errorMessage: mediaResult.error,
      metadata: { file_unique_id: mediaContent.file_unique_id },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    return mediaResult;
  }

  // 4. Create message record
  const messageInput: MessageInput = {
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    chat_title: message.chat.title,
    chat_type: message.chat.type,
    caption: message.caption,
    media_group_id: message.media_group_id,
    file_id: mediaContent.file_id,
    file_unique_id: mediaContent.file_unique_id,
    mime_type: mediaResult.fileInfo.mime_type,
    storage_path: mediaResult.fileInfo.storage_path,
    public_url: mediaResult.fileInfo.public_url,
    file_size: mediaResult.fileInfo.file_size,
    width: mediaContent.width,
    height: mediaContent.height,
    duration: message.video?.duration,
    telegram_data: message,
    message_url: messageUrl,
    processing_state: 'initialized',
    correlation_id: correlationId
  };

  const { data: newMessage, error: createError } = await supabase
    .from('messages')
    .insert(messageInput)
    .select()
    .single();

  if (createError) {
    await logMessageEvent('message_creation_failed', message.message_id.toString(), {
      correlationId,
      errorMessage: createError.message,
      metadata: { file_unique_id: mediaContent.file_unique_id },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    throw createError;
  }

  await logMessageEvent('message_created', newMessage.id, {
    correlationId,
    newState: newMessage,
    metadata: { 
      file_unique_id: mediaContent.file_unique_id,
      media_group_id: message.media_group_id
    },
    telegramMessageId: message.message_id,
    chatId: message.chat.id
  });

  return {
    success: true,
    fileInfo: mediaResult.fileInfo,
    messageId: newMessage.id
  };
}

/**
 * Enhanced media group handling with better synchronization and state tracking
 */
async function handleMediaGroup(
  message: TelegramMessage,
  mediaContent: any,
  context: MessageContext
): Promise<MediaResult> {
  const { correlationId } = context;
  const mediaGroupId = message.media_group_id;

  if (!mediaGroupId) {
    throw new Error('No media group ID found');
  }

  // Get existing group messages
  const { data: existingMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  const isFirstInGroup = !existingMessages || existingMessages.length === 0;
  const hasCaption = !!message.caption;

  // Process the media message
  const mediaResult = await processMediaMessage(message, mediaContent, correlationId);
  
  if (!mediaResult.success) {
    return mediaResult;
  }

  // Update group-related fields
  const updateData: Record<string, any> = {
    is_original_caption: hasCaption && isFirstInGroup,
    group_caption_synced: false
  };

  if (hasCaption) {
    updateData.message_caption_id = mediaResult.messageId;
  } else if (!isFirstInGroup) {
    // Try to sync with existing group content
    await supabase.rpc('xdelo_check_media_group_content', {
      p_media_group_id: mediaGroupId,
      p_message_id: mediaResult.messageId,
      p_correlation_id: correlationId
    });
  }

  // Update the message with group-related fields
  await supabase
    .from('messages')
    .update(updateData)
    .eq('id', mediaResult.messageId);

  // Log media group event
  await logMessageEvent('media_group_processed', mediaResult.messageId, {
    correlationId,
    metadata: {
      media_group_id: mediaGroupId,
      is_first_in_group: isFirstInGroup,
      has_caption: hasCaption,
      group_size: (existingMessages?.length || 0) + 1
    },
    telegramMessageId: message.message_id,
    chatId: message.chat.id
  });

  return mediaResult;
}

/**
 * Enhanced forward message handling with better metadata tracking
 */
async function handleForwardedMessage(
  message: TelegramMessage,
  mediaContent: any,
  context: MessageContext
): Promise<MediaResult> {
  const { correlationId } = context;

  // Extract forward information
  const forwardInfo = {
    origin: message.forward_origin,
    from_chat: message.forward_from_chat,
    from_message_id: message.forward_from_message_id,
    signature: message.forward_signature,
    sender_name: message.forward_sender_name,
    date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : undefined
  };

  // Process the media message first
  const mediaResult = await processMediaMessage(message, mediaContent, correlationId);
  
  if (!mediaResult.success) {
    return mediaResult;
  }

  // Update forward-related fields
  const updateData = {
    is_forward: true,
    forward_info: forwardInfo,
    original_message_id: message.forward_from_message_id,
    forward_signature: message.forward_signature,
    forward_sender_name: message.forward_sender_name,
    forward_date: forwardInfo.date
  };

  // Update the message with forward-related fields
  await supabase
    .from('messages')
    .update(updateData)
    .eq('id', mediaResult.messageId);

  // Log forward event
  await logMessageEvent('message_forwarded', mediaResult.messageId, {
    correlationId,
    metadata: {
      forward_info: forwardInfo,
      original_message_id: message.forward_from_message_id
    },
    telegramMessageId: message.message_id,
    chatId: message.chat.id
  });

  return mediaResult;
}

/**
 * Validate media content and handle edge cases
 */
async function validateMediaContent(
  message: TelegramMessage,
  mediaContent: any,
  correlationId: string
): Promise<{ isValid: boolean; error?: string }> {
  // Check for zero-sized files
  if (mediaContent.file_size === 0) {
    await logMessageEvent('media_validation_failed', message.message_id.toString(), {
      correlationId,
      errorMessage: 'Zero-sized file detected',
      metadata: { file_unique_id: mediaContent.file_unique_id },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    return { isValid: false, error: 'Zero-sized file detected' };
  }

  // Check for unsupported mime types
  if (mediaContent.mime_type && !mediaContent.mime_type.match(/^(image|video|application)\//)) {
    await logMessageEvent('media_validation_failed', message.message_id.toString(), {
      correlationId,
      errorMessage: 'Unsupported mime type',
      metadata: { 
        mime_type: mediaContent.mime_type,
        file_unique_id: mediaContent.file_unique_id 
      },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    return { isValid: false, error: 'Unsupported mime type' };
  }

  // Check for corrupted media groups
  if (message.media_group_id) {
    const { data: groupMessages } = await supabase
      .from('messages')
      .select('processing_state, error_message')
      .eq('media_group_id', message.media_group_id);

    const hasFailedMessages = groupMessages?.some(m => 
      m.processing_state === 'failed' || m.error_message
    );

    if (hasFailedMessages) {
      await logMessageEvent('media_group_validation_failed', message.message_id.toString(), {
        correlationId,
        errorMessage: 'Media group contains failed messages',
        metadata: { 
          media_group_id: message.media_group_id,
          file_unique_id: mediaContent.file_unique_id 
        },
        telegramMessageId: message.message_id,
        chatId: message.chat.id
      });
      return { isValid: false, error: 'Media group contains failed messages' };
    }
  }

  return { isValid: true };
}

/**
 * Handle media processing retries
 */
async function handleMediaProcessingRetry(
  message: TelegramMessage,
  mediaContent: any,
  correlationId: string,
  attempt: number = 1
): Promise<MediaResult> {
  const maxRetries = 3;
  const retryDelay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff

  try {
    return await processMediaMessage(message, mediaContent, correlationId);
  } catch (error) {
    if (attempt >= maxRetries) {
      await logMessageEvent('media_processing_failed', message.message_id.toString(), {
        correlationId,
        errorMessage: `Failed after ${maxRetries} attempts: ${error.message}`,
        metadata: { 
          file_unique_id: mediaContent.file_unique_id,
          attempts: attempt
        },
        telegramMessageId: message.message_id,
        chatId: message.chat.id
      });
      throw error;
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
    return handleMediaProcessingRetry(message, mediaContent, correlationId, attempt + 1);
  }
}

/**
 * Update handleNewMediaMessage with enhanced error handling
 */
async function handleNewMediaMessage(message: TelegramMessage, context: MessageContext): Promise<MediaResult> {
  const { correlationId } = context;

  try {
    // Extract media content with error handling
    const mediaContent = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;

    if (!mediaContent) {
      await logMessageEvent('media_extraction_failed', message.message_id.toString(), {
        correlationId,
        errorMessage: 'No media content found in message',
        telegramMessageId: message.message_id,
        chatId: message.chat.id
      });
      throw new Error('No media content found in message');
    }

    // Validate media content
    const validation = await validateMediaContent(message, mediaContent, correlationId);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Handle forwarded messages with retry
    if (message.forward_origin) {
      try {
        return await handleForwardedMessage(message, mediaContent, context);
      } catch (error) {
        await logMessageEvent('forward_processing_failed', message.message_id.toString(), {
          correlationId,
          errorMessage: error.message,
          metadata: { forward_origin: message.forward_origin },
          telegramMessageId: message.message_id,
          chatId: message.chat.id
        });
        throw error;
      }
    }

    // Handle media group messages with retry
    if (message.media_group_id) {
      try {
        return await handleMediaGroup(message, mediaContent, context);
      } catch (error) {
        await logMessageEvent('media_group_processing_failed', message.message_id.toString(), {
          correlationId,
          errorMessage: error.message,
          metadata: { media_group_id: message.media_group_id },
          telegramMessageId: message.message_id,
          chatId: message.chat.id
        });
        throw error;
      }
    }

    // Process regular media message with retry
    return await handleMediaProcessingRetry(message, mediaContent, correlationId);

  } catch (error) {
    // Log the final error if all retries failed
    await logMessageEvent('message_processing_failed', message.message_id.toString(), {
      correlationId,
      errorMessage: error.message,
      metadata: { 
        message_type: message.photo ? 'photo' : message.video ? 'video' : 'document'
      },
      telegramMessageId: message.message_id,
      chatId: message.chat.id
    });
    return { success: false, error: error.message };
  }
}

/**
 * Main handler for media messages
 */
async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<MediaResult> {
  try {
    const { correlationId, isEdit, previousMessage } = context;
    
    console.log(`[${correlationId}] Processing ${isEdit ? 'edited' : 'new'} media message ${message.message_id} in chat ${message.chat.id}`);
    
    if (isEdit && previousMessage) {
      return await handleEditedMediaMessage(message, context, previousMessage);
    }

    return await handleNewMediaMessage(message, context);
  } catch (error) {
    console.error(`[${context.correlationId}] Error handling media message:`, error);
    return { success: false, error: error.message };
  }
}

// Main webhook handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    const correlationId = crypto.randomUUID();
    
    const message = requestData.message || 
                   requestData.edited_message || 
                   requestData.channel_post || 
                   requestData.edited_channel_post;
    
    if (!message) {
      throw new Error('No message found in request');
    }
    
    const context: MessageContext = {
      correlationId,
      isEdit: !!requestData.edited_message || !!requestData.edited_channel_post,
      previousMessage: requestData.edited_message || requestData.edited_channel_post,
      isChannelPost: !!requestData.channel_post || !!requestData.edited_channel_post,
      isForwarded: !!message.forward_origin,
      startTime: new Date().toISOString()
    };
    
    if (message.photo || message.video || message.document) {
      const mediaResult = await handleMediaMessage(message, context);
      return new Response(
        JSON.stringify(mediaResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return formatSuccessResponse({
      success: true,
      message: 'Skipped non-media message'
    }, correlationId);
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return formatErrorResponse(error.message);
  }
});

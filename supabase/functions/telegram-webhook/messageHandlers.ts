import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { TelegramMessage, WebhookResponse, OtherMessageData, TelegramChatType, TelegramOtherMessageType, MessageData, ChatInfo, MediaInfo, TelegramUpdate, ChatMemberUpdate, TelegramError } from './types';
import { getLogger } from './logger';
import { triggerAnalysis } from './analysisHandler';

// Add type guard for error handling
function isError(error: unknown): error is TelegramError {
  return (
    error instanceof Error || 
    (typeof error === 'object' && 
     error !== null && 
     'message' in error && 
     typeof (error as any).message === 'string')
  );
}

function determineMessageType(message: TelegramMessage): TelegramOtherMessageType {
  if (message.text?.startsWith('/')) return 'command';
  if (message.text) return 'text';
  if (message.sticker) return 'sticker';
  if (message.voice) return 'voice';
  if (message.document) return 'document';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  if (message.venue) return 'venue';
  if (message.poll) return 'poll';
  if (message.dice) return 'dice';
  if (message.game) return 'game';
  if (message.callback_query) return 'callback_query';
  if (message.inline_query) return 'inline_query';
  return 'text';
}

export function extractMediaInfo(message: TelegramMessage): MediaInfo | null {
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return {
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      mime_type: 'image/jpeg',
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size
    };
  } 
  
  if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      mime_type: message.video.mime_type || 'video/mp4',
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      file_size: message.video.file_size
    };
  } 
  
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type || 'application/octet-stream',
      file_size: message.document.file_size
    };
  }
  
  return null;
}

export function extractChatInfo(message: TelegramMessage): ChatInfo {
  return {
    chat_id: message.chat.id,
    chat_type: message.chat.type as TelegramChatType,
    chat_title: message.chat.title || ''
  };
}

function determineUpdateType(update: TelegramUpdate): string {
  if (update.message?.photo || update.message?.video || update.message?.document) return 'media';
  if (update.message) return 'message';
  if (update.edited_message) return 'edited_message';
  if (update.channel_post) return 'channel_post';
  if (update.edited_channel_post) return 'edited_channel_post';
  if (update.my_chat_member) return 'my_chat_member';
  if (update.chat_member) return 'chat_member';
  if (update.callback_query) return 'callback_query';
  if (update.inline_query) return 'inline_query';
  return 'unknown';
}

// Simplified error handling helper
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error occurred';
}

async function handleMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  const startTime = performance.now();
  const telegram_message_id = message.message_id || Math.floor(Date.now() / 1000);
  
  try {
    // Log start
    await logWebhookEvent(
      supabase,
      'message_processing_start',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        metadata: {
          message_type: determineMessageType(message),
          is_channel_post: Boolean(message.sender_chat)
        }
      }
    );

    // Check for media first
    const mediaInfo = extractMediaInfo(message);
    if (mediaInfo) {
      return handleMediaMessage(supabase, message, correlationId);
    }

    // Prepare message data
    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: determineMessageType(message),
      telegram_message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title || '',
      message_text: message.text || '',
      is_edited: false,
      is_channel_post: Boolean(message.sender_chat),
      sender_chat_id: message.sender_chat?.id,
      processing_state: 'completed',
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      processing_correlation_id: correlationId,
      telegram_data: {
        message: {
          ...message,
          message_id: telegram_message_id
        },
        message_type: determineMessageType(message),
        content: {
          text: message.text,
          entities: message.entities,
          sticker: message.sticker,
          voice: message.voice,
          document: message.document,
          location: message.location,
          contact: message.contact
        }
      }
    };

    // Insert/Update message
    const { data: resultMessage, error } = await supabase
      .from('other_messages')
      .upsert(messageData, {
        onConflict: 'telegram_message_id,chat_id',
        returning: true
      })
      .single();

    if (error) throw error;

    // Log completion
    await logWebhookEvent(
      supabase,
      'message_processing_complete',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        processing_state: 'completed',
        duration_ms: Math.round(performance.now() - startTime),
        metadata: {
          message_id: resultMessage.id,
          message_type: messageData.message_type
        }
      }
    );

    return {
      success: true,
      message: 'Message processed successfully',
      correlation_id: correlationId,
      details: {
        message_id: resultMessage.id,
        message_type: messageData.message_type,
        is_channel_post: messageData.is_channel_post
      }
    };

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    
    await logWebhookEvent(
      supabase,
      'message_processing_error',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        error_message: errorMessage
      }
    );

    return {
      success: false,
      message: 'Failed to handle message',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

export async function handleWebhookUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  const updateType = determineUpdateType(update);

  try {
    switch (updateType) {
      case 'media':
        return handleMediaMessage(supabase, update.message!, correlationId);
      
      case 'message':
      case 'channel_post':
        return handleMessage(supabase, update.message || update.channel_post!, correlationId);
      
      case 'edited_message':
      case 'edited_channel_post':
        return handleMessage(supabase, update.edited_message || update.edited_channel_post!, correlationId);
      
      case 'my_chat_member':
      case 'chat_member':
        return handleChatMemberUpdate(supabase, update.my_chat_member || update.chat_member!, correlationId);
      
      default:
        logger.info('Unhandled update type', { updateType });
        return {
          success: true,
          message: 'Update acknowledged',
          correlation_id: correlationId
        };
    }
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Update handling error', { error: errorMessage });
    return {
      success: false,
      message: 'Error processing update',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

export async function handleEditedMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  const mediaInfo = extractMediaInfo(message);

  try {
    if (mediaInfo) {
      // For media messages, find by file_unique_id and update
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('file_unique_id', mediaInfo.file_unique_id)
        .maybeSingle();

      // Store edit history before processing
      const editHistory = existingMessage?.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_content: existingMessage?.telegram_data || {},
        new_content: { message }
      });

      // Process through media flow with edit history
      const editedMessage = {
        ...message,
        edit_history: editHistory,
        edit_date: message.edit_date
      };
      return await handleMediaMessage(supabase, editedMessage, correlationId);
    }

    // For non-media edits, handle in other_messages
    const messageType = determineMessageType(message);
    const { data: existingMessage } = await supabase
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    const editHistory = existingMessage?.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_content: existingMessage?.telegram_data || {},
      new_content: { message }
    });

    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: messageType,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title || '',
      message_text: message.text || '',
      is_edited: true,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
      is_channel_post: Boolean(message.sender_chat),
      sender_chat_id: message.sender_chat?.id,
      processing_state: 'completed',
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      processing_correlation_id: correlationId,
      telegram_data: {
        message,
        message_type: messageType,
        edit_history: editHistory,
        content: {
          text: message.text,
          sticker: message.sticker,
          voice: message.voice,
          document: message.document,
          location: message.location,
          contact: message.contact
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingMessage) {
      const { error: updateError } = await supabase
        .from('other_messages')
        .update(messageData)
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      logger.info('Updated existing other message with edit', { 
        messageId: existingMessage.id,
        messageType
      });
      
      return {
        success: true,
        message: 'Updated existing other message with edit',
        correlation_id: correlationId,
        details: { 
          message_id: existingMessage.id,
          message_type: messageType
        }
      };
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Created new edited other message', { 
      messageId: newMessage.id,
      messageType
    });
    
    return {
      success: true,
      message: 'Created new edited other message',
      correlation_id: correlationId,
      details: { 
        message_id: newMessage.id,
        message_type: messageType
      }
    };

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    
    return {
      success: false,
      message: 'Failed to handle edited message',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

export async function handleOtherMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  const startTime = performance.now();
  const telegram_message_id = message.message_id || Math.floor(Date.now() / 1000);
  
  try {
    // Log start of message processing
    await logWebhookEvent(
      supabase,
      'message_processing_start',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        media_type: 'text',
        metadata: {
          chat_type: message.chat.type,
          message_type: determineMessageType(message),
          is_channel_post: Boolean(message.sender_chat),
          has_entities: Boolean(message.entities?.length)
        }
      }
    );

    const messageType = determineMessageType(message);
    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: messageType,
      telegram_message_id,  // Use our guaranteed ID
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title || '',
      message_text: message.text || '',
      is_edited: Boolean(message.edit_date),
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
      is_channel_post: Boolean(message.sender_chat),
      sender_chat_id: message.sender_chat?.id,
      processing_state: 'completed',
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      processing_correlation_id: correlationId,
      telegram_data: {
        message: {
          ...message,
          message_id: telegram_message_id  // Ensure message_id is set in telegram_data
        },
        message_type: messageType,
        content: {
          text: message.text,
          entities: message.entities,
          sticker: message.sticker,
          voice: message.voice,
          document: message.document,
          location: message.location,
          contact: message.contact
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', telegram_message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    let resultMessage;

    if (existingMessage) {
      // Update existing message
      const { data: updatedMessage, error: updateError } = await supabase
        .from('other_messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      resultMessage = updatedMessage;

      logger.info('Updated existing message', {
        messageId: existingMessage.id,
        messageType
      });
    } else {
      // Insert new message
      const { data: newMessage, error: insertError } = await supabase
        .from('other_messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      resultMessage = newMessage;

      logger.info('Created new message', {
        messageId: newMessage.id,
        messageType
      });
    }

    // Special handling for channel posts
    if (message.sender_chat) {
      await logWebhookEvent(
        supabase,
        'channel_post_processed',
        message.chat.id,
        telegram_message_id,
        correlationId,
        {
          processing_state: 'completed',
          duration_ms: Math.round(performance.now() - startTime),
          metadata: {
            channel_id: message.sender_chat.id,
            channel_title: message.sender_chat.title
          }
        }
      );
    }

    // Log completion
    await logWebhookEvent(
      supabase,
      'message_processing_complete',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        processing_state: 'completed',
        duration_ms: Math.round(performance.now() - startTime),
        metadata: {
          message_type: messageType,
          message_id: resultMessage.id
        }
      }
    );

    return {
      success: true,
      message: 'Message processed successfully',
      correlation_id: correlationId,
      details: {
        message_id: resultMessage.id,
        message_type: messageType,
        is_channel_post: Boolean(message.sender_chat)
      }
    };

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    
    await logWebhookEvent(
      supabase,
      'message_processing_error',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        error_message: errorMessage
      }
    );

    return {
      success: false,
      message: 'Failed to handle message',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

export async function handleChatMemberUpdate(
  supabase: SupabaseClient,
  memberUpdate: ChatMemberUpdate,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  
  try {
    // First check if this is an edit to a media message
    if (memberUpdate.edited_message || memberUpdate.edited_channel_post) {
      const editedMessage = memberUpdate.edited_message || memberUpdate.edited_channel_post;
      if (editedMessage) {
        return await handleEditedMessage(supabase, editedMessage, correlationId);
      }
    }

    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: 'chat_member',
      telegram_message_id: Date.now(),
      chat_id: memberUpdate.chat.id,
      chat_type: memberUpdate.chat.type as TelegramChatType,
      chat_title: memberUpdate.chat.title || '',
      is_edited: false,
      is_channel_post: false,
      processing_state: 'completed',
      processing_correlation_id: correlationId,
      telegram_data: {
        message: {
          message_id: Date.now(),
          chat: memberUpdate.chat,
          date: memberUpdate.date || Math.floor(Date.now() / 1000)
        },
        message_type: 'chat_member',
        content: {},
        member_update: memberUpdate,
        update_type: memberUpdate.my_chat_member ? 'my_chat_member' : 'chat_member',
        old_status: memberUpdate.old_chat_member?.status,
        new_status: memberUpdate.new_chat_member?.status
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newMessage, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Created new chat member update', { 
      messageId: newMessage.id,
      updateType: messageData.telegram_data.update_type
    });
    
    return {
      success: true,
      message: 'Created new chat member update',
      correlation_id: correlationId,
      details: { 
        message_id: newMessage.id,
        update_type: messageData.telegram_data.update_type
      }
    };

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    
    return {
      success: false,
      message: 'Failed to handle chat member update',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

// Add webhook logging helper
async function logWebhookEvent(
  supabase: SupabaseClient,
  event_type: string,
  chat_id: number,
  message_id: number,
  correlationId: string,
  options?: {
    media_type?: string;
    processing_state?: string;
    duration_ms?: number;
    error_message?: string;
    metadata?: Record<string, any>;
    raw_data?: Record<string, any>;
  }
) {
  try {
    const startTime = performance.now();
    
    await supabase.from('webhook_logs').insert({
      event_type,
      chat_id,
      message_id,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
      media_type: options?.media_type,
      processing_state: options?.processing_state,
      duration_ms: options?.duration_ms,
      error_message: options?.error_message,
      metadata: options?.metadata,
      raw_data: options?.raw_data
    });

    console.log('Webhook event logged:', {
      event_type,
      chat_id,
      message_id,
      correlation_id: correlationId,
      duration_ms: Math.round(performance.now() - startTime)
    });
  } catch (logError) {
    console.error('Failed to log webhook event:', {
      error: logError,
      correlation_id: correlationId,
      event_type,
      chat_id,
      message_id
    });
  }
}

// Update handleMediaMessage to use webhook logging
export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const startTime = performance.now();
  const logger = getLogger(correlationId);
  const telegram_message_id = message.message_id || Math.floor(Date.now() / 1000);
  
  try {
    // Log start with media type
    await logWebhookEvent(
      supabase,
      'media_processing_start',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        metadata: {
          chat_type: message.chat.type,
          has_caption: Boolean(message.caption),
          media_group_id: message.media_group_id
        }
      }
    );

    const chatInfo = extractChatInfo(message);
    const mediaInfo = extractMediaInfo(message);
    
    if (!mediaInfo) {
      throw new Error("No media found in message");
    }

    // Determine default mime type based on media type
    const defaultMimeType = message.photo ? 'image/jpeg' : 
                          message.video ? 'video/mp4' : 
                          'application/octet-stream';

    // Use the actual mime type or fall back to default
    const mimeType = mediaInfo.mime_type || defaultMimeType;
    
    // Get file extension from mime type
    const fileExt = mimeType.split('/')[1] || 'bin';
    const storagePath = `${mediaInfo.file_unique_id}.${fileExt}`;

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id, telegram_message_id")
      .eq("file_unique_id", mediaInfo.file_unique_id)
      .maybeSingle();

    const messageData: MessageData = {
      id: crypto.randomUUID(),
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      chat_type: chatInfo.chat_type,
      chat_title: chatInfo.chat_title,
      media_group_id: message.media_group_id,
      caption: message.caption || "",
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mimeType,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      telegram_data: { message },
      processing_state: message.caption ? "pending" : "initialized",
      processing_correlation_id: correlationId,
      is_original_caption: Boolean(message.caption),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let messageId: string;

    if (existingMessage) {
      // Use the UUID when updating related records
      await supabase
        .from("messages")
        .update({
          message_caption_id: existingMessage.id,
          ...messageData,
          retry_count: existingMessage.retry_count,
          analyzed_content: existingMessage.analyzed_content,
          group_caption_synced: true,
        })
        .eq("media_group_id", message.media_group_id)
        .neq("telegram_message_id", message.message_id);

      messageId = existingMessage.id;
      
      logger.info('Updated existing message', { 
        messageId,
        hasCaption: Boolean(message.caption),
        inMediaGroup: Boolean(message.media_group_id)
      });
    } else {
      const { data: newMessage, error: insertError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      messageId = newMessage.id;
      
      logger.info('Created new message', { 
        messageId,
        hasCaption: Boolean(message.caption),
        inMediaGroup: Boolean(message.media_group_id)
      });
    }

    // Download and store media
    const botToken = Deno?.env?.get?.('TELEGRAM_BOT_TOKEN') ?? '';
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${mediaInfo.file_id}`
    );

    const { data: storageData } = await supabase
      .storage
      .from('telegram-media')
      .upload(
        storagePath,
        await response.arrayBuffer(),
        {
          contentType: mimeType,
          upsert: true
        }
      );

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Handle media group syncing and analysis
    if (message.media_group_id) {
      if (!message.caption) {
        // For messages without caption, check if any message in the group has analyzed content
        const { data: analyzedGroupMessages, error: groupQueryError } = await supabase
          .from("messages")
          .select("id, analyzed_content")
          .eq("media_group_id", message.media_group_id)
          .not("analyzed_content", "is", null)
          .eq("processing_state", "completed")
          .order("created_at", { ascending: true })
          .limit(1);

        if (groupQueryError) {
          logger.error('Error checking group messages for analysis', {
            error: groupQueryError,
            mediaGroupId: message.media_group_id
          });
          throw groupQueryError;
        }

        if (analyzedGroupMessages?.[0]) {
          // Use existing analyzed content from group
          const sourceMessage = analyzedGroupMessages[0];
          logger.info('Found existing analyzed content in group', {
            messageId,
            sourceMessageId: sourceMessage.id,
            mediaGroupId: message.media_group_id
          });

          await supabase
            .from("messages")
            .update({
              analyzed_content: sourceMessage.analyzed_content,
              message_caption_id: sourceMessage.id,
              processing_state: "completed",
              processing_completed_at: new Date().toISOString(),
              group_caption_synced: true
            })
            .eq("id", messageId);
        }
      }
      // If message has caption, let database trigger handle group syncing
    } else if (message.caption) {
      logger.info('Triggering analysis for single message', { 
        messageId,
        correlationId,
        mediaGroupId: message.media_group_id 
      });

      await triggerAnalysis(
        parseInt(messageId),
        correlationId,
        supabase,
        message.media_group_id
      );

      // Log analysis trigger
      await logWebhookEvent(
        supabase,
        'analysis_triggered',
        message.chat.id,
        message.message_id,
        correlationId
      );
    }

    // Log completion with duration
    await logWebhookEvent(
      supabase,
      'media_processing_complete',
      message.chat.id,
      message.message_id,
      correlationId,
      {
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        processing_state: 'completed',
        duration_ms: Math.round(performance.now() - startTime),
        metadata: {
          file_size: mediaInfo.file_size,
          mime_type: mimeType,
          processing_state: messageData.processing_state
        }
      }
    );

    return {
      success: true,
      message: "Media processed successfully",
      correlation_id: correlationId,
      details: {
        message_id: messageId,
        public_url: publicUrl,
        media_group_id: message.media_group_id,
        mime_type: mimeType,
        has_caption: Boolean(message.caption),
        processing_state: messageData.processing_state
      }
    };

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    
    await logWebhookEvent(
      supabase,
      'media_processing_error',
      message.chat.id,
      telegram_message_id,
      correlationId,
      {
        error_message: errorMessage
      }
    );

    return {
      success: false,
      message: 'Error handling media message',
      error: errorMessage,
      correlation_id: correlationId
    };
  }
}

async function syncMediaGroupContent(
  supabase: SupabaseClient,
  messageId: string,  // This is the UUID from messages table
  mediaGroupId: string,
  caption: string,
  correlationId: string
): Promise<void> {
  try {
    // Update other messages in group
    const { error } = await supabase
      .from("messages")
      .update({
        caption,
        message_caption_id: messageId,  // Using the UUID as foreign key
        is_original_caption: false,
        group_caption_synced: true,
        // ... other fields
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", messageId);

    if (error) throw error;
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    console.error("Error syncing media group:", {
      correlation_id: correlationId,
      message_id: messageId,
      error: errorMessage
    });
    throw new Error(errorMessage);
  }
}

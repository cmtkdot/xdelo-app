import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  xdelo_getTelegramMediaInfo,
  xdelo_validateAndRepairMedia
} from '../utils/mediaUtils.ts';
import { 
  xdelo_logMessageCreation, 
  xdelo_logMessageError,
  xdelo_logMediaGroupSync
} from '../../_shared/messageLogger.ts';

// Message types and context interfaces
export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  caption?: string;
  date: number;
  edit_date?: number;
  media_group_id?: string;
  from?: {
    id: number;
    username?: string;
  };
  photo?: any[];
  video?: any;
  document?: any;
  animation?: any;
  sticker?: any;
  voice?: any;
  audio?: any;
  forward_from?: any;
  forward_from_chat?: any;
  forward_origin?: any;
  [key: string]: any;
}

export interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
}

export interface ForwardInfo {
  is_forwarded: boolean;
  forward_origin_type?: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  forward_date?: string;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}

export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id: string;
  file_unique_id: string;
  storage_path: string;
  public_url: string;
  correlation_id: string;
  processing_state: string;
  is_edited_channel_post?: boolean;
  forward_info?: ForwardInfo;
  telegram_data: any;
  edit_date?: string;
  is_forward?: boolean;
  edit_history?: any[];
}

/**
 * Main handler for all media messages
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // First check if this file already exists in our system
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', message.photo?.[0]?.file_unique_id || 
                           message.video?.file_unique_id || 
                           message.document?.file_unique_id)
      .eq('deleted_from_telegram', false)
      .maybeSingle();

    // If file exists and not an edit, update existing record
    if (existingMessage && !context.isEdit) {
      console.log(`File already exists with ID ${existingMessage.id}, updating record`);
      
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlation_id: correlationId,
          updated_at: new Date().toISOString(),
          telegram_data: message,
          // Don't overwrite storage_path or public_url
          processing_state: message.caption !== existingMessage.caption ? 'pending' : existingMessage.processing_state,
          analyzed_content: message.caption !== existingMessage.caption ? null : existingMessage.analyzed_content
        })
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, updated: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If it's a new file or an edit, proceed with media download and upload
    const mediaInfo = await xdelo_getTelegramMediaInfo(message, correlationId);
    
    // Validate and repair the media to ensure proper content type
    if (mediaInfo.storage_path) {
      await xdelo_validateAndRepairMedia(mediaInfo.storage_path);
    }
    
    // Check if this is a new message or an existing message
    const { data: existingMessages } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id);
    
    // If message already exists, update it
    if (existingMessages && existingMessages.length > 0) {
      return await updateExistingMediaMessage(message, context, mediaInfo, existingMessages[0]);
    }
    
    // Otherwise create a new message
    return await createNewMediaMessage(message, context, mediaInfo);
  } catch (error) {
    console.error('Error handling media message:', error);
    
    // Log error with shared logger
    await xdelo_logMessageError(
      "unknown", // We don't have a message ID yet
      `Media handling error: ${error.message}`,
      context.correlationId,
      'message_create'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle updating an existing media message
 */
async function updateExistingMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  mediaInfo: any,
  existingMessage: any
): Promise<Response> {
  try {
    // Store previous state in edit_history
    let editHistory = existingMessage.edit_history || [];
    
    // Add media information to edit history for tracking changes
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      new_caption: message.caption,
      edit_date: message.edit_date 
        ? new Date(message.edit_date * 1000).toISOString() 
        : new Date().toISOString(),
      previous_analyzed_content: existingMessage.analyzed_content,
      previous_media_info: {
        file_id: existingMessage.file_id,
        file_unique_id: existingMessage.file_unique_id,
        storage_path: existingMessage.storage_path,
        public_url: existingMessage.public_url
      },
      new_media_info: {
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url
      }
    });
    
    // Check if caption changed or media file changed
    const captionChanged = message.caption !== existingMessage.caption;
    const mediaChanged = mediaInfo.file_unique_id !== existingMessage.file_unique_id;
    
    // Update the existing message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        caption: message.caption,
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url,
        telegram_data: message,
        edit_date: message.edit_date 
          ? new Date(message.edit_date * 1000).toISOString() 
          : new Date().toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        is_edited: true,
        correlation_id: context.correlationId,
        updated_at: new Date().toISOString(),
        // Reset processing state if caption or media changed
        processing_state: (captionChanged || mediaChanged) ? 'pending' : existingMessage.processing_state,
        // Reset analyzed content if caption or media changed
        analyzed_content: (captionChanged || mediaChanged) ? null : existingMessage.analyzed_content,
        // Mark as needing group sync if caption or media changed and part of a group
        group_caption_synced: (captionChanged || mediaChanged) && message.media_group_id 
          ? false 
          : existingMessage.group_caption_synced,
        // Set is_original_caption to true if caption was changed (new source of truth)
        is_original_caption: captionChanged ? true : existingMessage.is_original_caption
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    // Process the updated message for analysis if needed
    if ((captionChanged || mediaChanged) && message.caption) {
      await triggerCaptionAnalysis(existingMessage.id, message, context);
    } 
    // If part of a media group with no caption, try to sync with group
    else if (!message.caption && message.media_group_id) {
      await syncFromMediaGroup(message.media_group_id, existingMessage.id, context.correlationId);
    }

    return new Response(
      JSON.stringify({ success: true, updated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating existing media message:', error);
    await xdelo_logMessageError(
      existingMessage.id,
      `Error updating media message: ${error.message}`,
      context.correlationId,
      'message_update'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle creating a new media message
 */
async function createNewMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  mediaInfo: any
): Promise<Response> {
  try {
    // Check for duplicate by file_unique_id
    const { data: existingMedia } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('file_unique_id', mediaInfo.file_unique_id)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: false })
      .limit(1);

    // If duplicate exists, update that record
    if (existingMedia && existingMedia.length > 0) {
      console.log(`Duplicate message detected with file_unique_id ${mediaInfo.file_unique_id}`);
      
      // Update the existing message with the new media info
      await handleDuplicateMedia(message, context, mediaInfo, existingMedia[0]);
      
      return new Response(
        JSON.stringify({ success: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      storage_path: mediaInfo.storage_path,
      public_url: mediaInfo.public_url,
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
        edit_date: message.edit_date 
          ? new Date(message.edit_date * 1000).toISOString() 
          : new Date().toISOString()
      }] : []
    };

    // Insert the message into the database
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert([messageInput])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Log the message creation
    await xdelo_logMessageCreation(
      insertedMessage.id,
      message.message_id,
      message.chat.id,
      context.correlationId,
      {
        file_unique_id: mediaInfo.file_unique_id,
        media_group_id: message.media_group_id,
        is_forwarded: !!forwardInfo,
        forward_info: forwardInfo,
        message_type: 'media',
        has_caption: !!message.caption
      }
    );

    // Process the new message
    await processNewMessage(message, insertedMessage.id, context);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating new media message:', error);
    
    await xdelo_logMessageError(
      "unknown",
      `Error creating media message: ${error.message}`,
      context.correlationId,
      'message_create'
    );
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle duplicate media detection
 */
async function handleDuplicateMedia(
  message: TelegramMessage,
  context: MessageContext,
  mediaInfo: any,
  existingMessage: any
): Promise<void> {
  // Check if caption changed
  const captionChanged = message.caption !== existingMessage.caption;
  
  // Create history entry for this update
  let editHistory = existingMessage.edit_history || [];
  editHistory.push({
    timestamp: new Date().toISOString(),
    previous_caption: existingMessage.caption,
    new_caption: message.caption,
    duplicate_update: true,
    previous_media_info: {
      storage_path: existingMessage.storage_path,
      public_url: existingMessage.public_url
    },
    new_media_info: {
      storage_path: mediaInfo.storage_path,
      public_url: mediaInfo.public_url
    }
  });
  
  // Update the existing message with new media info
  const { error: updateError } = await supabaseClient
    .from('messages')
    .update({
      caption: message.caption,
      chat_id: message.chat.id,
      chat_title: message.chat.title,
      chat_type: message.chat.type,
      telegram_message_id: message.message_id,
      telegram_data: message,
      correlation_id: context.correlationId,
      media_group_id: message.media_group_id,
      // Always update with new storage path and public URL from the re-upload
      storage_path: mediaInfo.storage_path,
      public_url: mediaInfo.public_url,
      file_id: mediaInfo.file_id, // Update with new file_id
      // Reset processing if caption changed
      processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
      analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
      updated_at: new Date().toISOString(),
      is_duplicate: true,
      edit_history: editHistory
    })
    .eq('id', existingMessage.id);

  if (updateError) throw updateError;

  // Process the message after update
  await processNewMessage(message, existingMessage.id, context);
}

/**
 * Process a message after creation or update
 */
async function processNewMessage(
  message: TelegramMessage,
  messageId: string,
  context: MessageContext
): Promise<void> {
  // Handle media group message with no caption - try to sync content from group
  if (!message.caption && message.media_group_id) {
    console.log(`Message ${messageId} has no caption but is part of media group ${message.media_group_id}`);
    
    try {
      // Use the database function to check and sync with media group
      const { data: syncResult, error: syncError } = await supabaseClient.rpc(
        'xdelo_check_media_group_content',
        {
          p_media_group_id: message.media_group_id,
          p_message_id: messageId,
          p_correlation_id: context.correlationId
        }
      );
      
      if (syncError) {
        console.error('Error checking media group content:', syncError);
        
        // Fallback: Try to sync directly
        await syncFromMediaGroup(message.media_group_id, messageId, context.correlationId);
      } else if (syncResult && syncResult.success) {
        console.log(`Successfully synced content from media group ${message.media_group_id}`);
      } else {
        // If no content to sync, schedule a delayed re-check
        setTimeout(async () => {
          try {
            console.log(`Performing delayed re-check for message ${messageId} in group ${message.media_group_id}`);
            await supabaseClient.rpc(
              'xdelo_check_media_group_content',
              {
                p_media_group_id: message.media_group_id,
                p_message_id: messageId,
                p_correlation_id: context.correlationId
              }
            );
          } catch (delayedError) {
            console.error('Delayed media group check failed:', delayedError);
          }
        }, 10000); // 10 seconds delay
      }
    } catch (syncError) {
      console.error('Failed to sync with media group:', syncError);
    }
  }
  // If message has caption, process it immediately
  else if (message.caption) {
    await triggerCaptionAnalysis(messageId, message, context);
  }
}

/**
 * Trigger caption analysis for a message
 */
async function triggerCaptionAnalysis(
  messageId: string,
  message: TelegramMessage,
  context: MessageContext
): Promise<void> {
  console.log(`Message ${messageId} has caption, triggering analysis`);
  
  try {
    // First try direct caption processor
    try {
      const { data: processorResult, error: processorError } = await supabaseClient.functions.invoke(
        'manual-caption-parser',
        {
          body: {
            messageId: messageId,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: context.correlationId,
            trigger_source: 'webhook_handler',
            force_reprocess: true // Force reprocessing for new messages
          }
        }
      );
      
      if (processorError) {
        throw new Error(`Manual parser error: ${processorError.message}`);
      }
      
      console.log('Manual caption processing successful:', processorResult);
    } catch (directError) {
      console.error('Manual caption processor failed, falling back to database function:', directError);
      
      // Fallback to database function
      const { data: captionResult, error: captionError } = await supabaseClient.rpc(
        'xdelo_analyze_message_caption',
        {
          p_message_id: messageId,
          p_correlation_id: context.correlationId,
          p_caption: message.caption,
          p_media_group_id: message.media_group_id,
          p_force_reprocess: true
        }
      );
      
      if (captionError) {
        console.error('Database caption processing failed:', captionError);
      } else {
        console.log('Database caption processing successful:', captionResult);
      }
    }
  } catch (processingError) {
    console.error('Error in caption processing:', processingError);
  }
}

/**
 * Sync content from media group
 */
async function syncFromMediaGroup(
  mediaGroupId: string,
  targetMessageId: string,
  correlationId: string
): Promise<boolean> {
  try {
    console.log(`Direct sync check for message ${targetMessageId} in group ${mediaGroupId}`);
    
    // Find any message in the group with analyzed_content
    const { data: groupMessages } = await supabaseClient
      .from('messages')
      .select('id, analyzed_content, is_original_caption')
      .eq('media_group_id', mediaGroupId)
      .neq('id', targetMessageId)
      .order('created_at', { ascending: true });
    
    if (!groupMessages || groupMessages.length === 0) {
      console.log(`No other messages found in group ${mediaGroupId}`);
      return false;
    }
    
    // Look for a message with analyzed_content
    const sourceMessage = groupMessages.find(m => m.analyzed_content && m.is_original_caption);
    
    // If no message with is_original_caption, try any with analyzed_content
    const fallbackSource = !sourceMessage ? 
      groupMessages.find(m => m.analyzed_content) : null;
      
    if (!sourceMessage && !fallbackSource) {
      console.log(`No messages with analyzed_content found in group ${mediaGroupId}`);
      return false;
    }
    
    const source = sourceMessage || fallbackSource;
    
    // Update the target message with the analyzed_content from the source
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: source.analyzed_content,
        message_caption_id: source.id,
        is_original_caption: false,
        group_caption_synced: true,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', targetMessageId);
    
    if (updateError) {
      console.error(`Error updating message ${targetMessageId} with group content:`, updateError);
      return false;
    }
    
    // Log the sync operation
    await xdelo_logMediaGroupSync(
      source.id, 
      targetMessageId,
      mediaGroupId,
      correlationId,
      {
        sync_method: 'direct_database',
        sync_trigger: 'media_group_member_without_caption'
      }
    );
    
    console.log(`Successfully synced content from message ${source.id} to message ${targetMessageId}`);
    return true;
  } catch (error) {
    console.error('Error in syncFromMediaGroup:', error);
    return false;
  }
}

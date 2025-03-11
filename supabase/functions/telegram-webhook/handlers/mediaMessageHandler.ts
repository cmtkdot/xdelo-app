
import { supabaseClient } from '../../_shared/supabase.ts';
import { getMediaInfo } from '../utils/mediaUtils.ts';
import { logMessageOperation } from '../utils/logger.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput,
} from '../types.ts';
import { 
  xdelo_logMessageCreation, 
  xdelo_logMessageEdit, 
  xdelo_logMessageError,
  xdelo_logMediaGroupSync
} from '../../_shared/messageLogger.ts';

export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage } = context;
    const mediaInfo = await getMediaInfo(message);
    
    // Check if this is an edited message
    if (isEdit && previousMessage) {
      return await handleEditedMediaMessage(message, context, mediaInfo, previousMessage);
    }

    // Handle new message by checking for duplicates first
    return await handleNewMediaMessage(message, context, mediaInfo);

  } catch (error) {
    console.error('Error handling media message:', error);
    // Log error event using new logging system
    const errorMetadata = {
      message: 'Error handling media message',
      error_message: error.message,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      error_code: error.code,
      processing_stage: 'media_handling'
    };
    
    try {
      // Use new logging system - but since we don't have a message ID yet, 
      // we'll use the legacy logging for errors at this stage
      await logMessageOperation(
        'error',
        context.correlationId,
        errorMetadata
      );
    } catch (logError) {
      console.error('Error logging error operation:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

async function handleEditedMediaMessage(
  message: TelegramMessage, 
  context: MessageContext, 
  mediaInfo: any, 
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
    
    // Add media information to edit history for tracking changes
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      new_caption: message.caption,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
      previous_analyzed_content: existingMessage.analyzed_content,
      previous_media_info: {
        file_id: existingMessage.file_id,
        file_unique_id: existingMessage.file_unique_id,
        storage_path: existingMessage.storage_path,
        public_url: existingMessage.public_url,
        mime_type: existingMessage.mime_type
      },
      new_media_info: {
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url,
        mime_type: mediaInfo.mime_type
      }
    });
    
    // Check if caption changed or media file changed
    const captionChanged = message.caption !== existingMessage.caption;
    const mediaChanged = mediaInfo.file_unique_id !== existingMessage.file_unique_id;
    
    // Update the message with new media info, caption and edit history
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        caption: message.caption,
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url,
        mime_type: mediaInfo.mime_type,
        telegram_data: message,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        is_edited: true,
        correlation_id: correlationId,
        updated_at: new Date().toISOString(),
        // Reset processing state if caption or media changed
        processing_state: (captionChanged || mediaChanged) ? 'pending' : existingMessage.processing_state,
        // Reset analyzed content if caption or media changed
        analyzed_content: (captionChanged || mediaChanged) ? null : existingMessage.analyzed_content,
        // Mark as needing group sync if caption or media changed and part of a group
        group_caption_synced: (captionChanged || mediaChanged) && message.media_group_id ? false : existingMessage.group_caption_synced,
        // Set is_original_caption to true if caption was changed (new source of truth)
        is_original_caption: captionChanged ? true : existingMessage.is_original_caption
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    // Log the edit event using new logging system
    const editType = captionChanged 
      ? 'caption_change' 
      : (mediaChanged ? 'media_change' : 'message_edit');
    
    await xdelo_logMessageEdit(
      existingMessage.id,
      message.message_id,
      message.chat.id,
      correlationId,
      editType,
      {
        file_unique_id: mediaInfo.file_unique_id,
        media_group_id: message.media_group_id,
        caption_changed: captionChanged,
        media_changed: mediaChanged,
        previous_caption: existingMessage.caption,
        new_caption: message.caption
      }
    );
    
    // Keep legacy logging for backward compatibility
    try {
      await logMessageOperation(
        'edit',
        correlationId,
        {
          message: `Message ${message.message_id} edited in chat ${message.chat.id}`,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaInfo.file_unique_id,
          source_message_id: existingMessage.id,
          edit_type: captionChanged ? 'caption_changed' : (mediaChanged ? 'media_changed' : 'other_edit'),
          media_group_id: message.media_group_id
        }
      );
    } catch (logError) {
      console.error('Error logging edit operation:', logError);
    }

    // If caption or media changed and has content, directly trigger caption analysis
    if ((captionChanged || mediaChanged) && message.caption) {
      try {
        console.log(`Caption or media changed, directly triggering analysis for message ${existingMessage.id}`);
        
        // Directly call the parse-caption-with-ai edge function for immediate processing
        const analyzeResponse = await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            messageId: existingMessage.id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: correlationId,
            isEdit: true
          }
        });
        
        if (!analyzeResponse.error) {
          console.log('Direct caption analysis successful');
        } else {
          console.error('Direct caption analysis failed:', analyzeResponse.error);
          
          // Fallback: queue for processing
          const { error: queueError } = await supabaseClient.rpc(
            'xdelo_queue_message_for_processing',
            {
              p_message_id: existingMessage.id,
              p_correlation_id: correlationId,
              p_priority: 10 // Higher priority for edits
            }
          );
          
          if (queueError) {
            console.error('Failed to queue edited message for processing:', queueError);
          } else {
            console.log('Edited message queued for processing with high priority');
          }
        }
      } catch (analysisError) {
        console.error('Failed to process edited caption:', analysisError);
        
        // Still try to queue as fallback
        try {
          await supabaseClient.rpc(
            'xdelo_queue_message_for_processing',
            {
              p_message_id: existingMessage.id,
              p_correlation_id: correlationId,
              p_priority: 10
            }
          );
        } catch (queueError) {
          console.error('Failed to queue edited message for processing:', queueError);
        }
      }
    } 
    // If caption was removed or media changed, check if this is part of a media group and needs syncing
    else if ((captionChanged && !message.caption || mediaChanged) && message.media_group_id) {
      try {
        console.log(`Caption removed or media changed, checking for media group sync from group ${message.media_group_id}`);
        
        // Look for another message in the group with a caption
        const { data: groupMessages } = await supabaseClient
          .from('messages')
          .select('id, caption, analyzed_content, is_original_caption')
          .eq('media_group_id', message.media_group_id)
          .neq('id', existingMessage.id)
          .order('created_at', { ascending: true });
        
        if (groupMessages && groupMessages.length > 0) {
          // Find a message with caption and analyzed_content
          const captionMessage = groupMessages.find(m => m.caption && m.analyzed_content);
          
          if (captionMessage) {
            console.log(`Found another message with caption in group: ${captionMessage.id}`);
            
            // Log the sync operation using new logging
            await xdelo_logMediaGroupSync(
              captionMessage.id,
              existingMessage.id,
              message.media_group_id,
              correlationId,
              {
                sync_reason: 'caption_removed_or_media_changed',
                message_count: groupMessages.length + 1
              }
            );
            
            // Update the group relationships
            await supabaseClient.rpc(
              'xdelo_sync_media_group_content',
              {
                p_source_message_id: captionMessage.id,
                p_media_group_id: message.media_group_id,
                p_correlation_id: correlationId
              }
            );
          } else {
            console.log('No other message with caption found in the group');
          }
        }
      } catch (syncError) {
        console.error('Failed to sync from media group after caption removal or media change:', syncError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If existing message not found, handle as new message
  return await handleNewMediaMessage(message, context, mediaInfo);
}

async function handleNewMediaMessage(
  message: TelegramMessage, 
  context: MessageContext, 
  mediaInfo: any
): Promise<Response> {
  const { correlationId } = context;

  // Check for duplicate message by file_unique_id before creating new record
  // But we'll still update it with the new media info since we always re-upload
  const { data: existingMedia } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('file_unique_id', mediaInfo.file_unique_id)
    .eq('deleted_from_telegram', false)
    .order('created_at', { ascending: false })
    .limit(1);

  // If file already exists, update instead of creating new record
  if (existingMedia && existingMedia.length > 0) {
    const existingMessage = existingMedia[0];
    console.log(`Duplicate message detected with file_unique_id ${mediaInfo.file_unique_id}, updating existing record`);
    
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
        public_url: existingMessage.public_url,
        mime_type: existingMessage.mime_type
      },
      new_media_info: {
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url,
        mime_type: mediaInfo.mime_type
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
        correlation_id: correlationId,
        media_group_id: message.media_group_id,
        // Update with new storage path and public URL from the re-upload
        storage_path: mediaInfo.storage_path,
        public_url: mediaInfo.public_url,
        mime_type: mediaInfo.mime_type,
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

    // Log the duplicate detection using new logging
    const editType = captionChanged ? 'caption_change' : 'message_update';
    await xdelo_logMessageEdit(
      existingMessage.id,
      message.message_id,
      message.chat.id,
      correlationId,
      editType,
      {
        file_unique_id: mediaInfo.file_unique_id,
        update_type: 'duplicate_update',
        media_group_id: message.media_group_id,
        caption_changed: captionChanged,
        previous_caption: existingMessage.caption,
        new_caption: message.caption
      }
    );
    
    // Keep legacy logging for backward compatibility
    await logMessageOperation(
      'success',
      context.correlationId,
      {
        message: `Duplicate message detected with file_unique_id ${mediaInfo.file_unique_id}, media re-uploaded`,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        file_unique_id: mediaInfo.file_unique_id,
        sourceMessageId: existingMessage.id, // Fixed: changed from existing_message_id to sourceMessageId
        update_type: 'duplicate_update',
        media_group_id: message.media_group_id
      }
    );

    // Process the updated message for caption analysis or media group syncing
    await processMessage(message, existingMessage, context);

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
    ...mediaInfo,
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
    }] : []
  };

  // Insert the message into the database
  const { data: insertedMessage, error: insertError } = await supabaseClient
    .from('messages')
    .insert([messageInput])
    .select('id')
    .single();

  if (insertError) throw insertError;

  // Log the insert event using new logging
  await xdelo_logMessageCreation(
    insertedMessage.id,
    message.message_id,
    message.chat.id,
    correlationId,
    {
      file_unique_id: mediaInfo.file_unique_id,
      media_group_id: message.media_group_id,
      is_forwarded: !!forwardInfo,
      forward_info: forwardInfo,
      message_type: 'media',
      has_caption: !!message.caption
    }
  );
  
  // Keep legacy logging for backward compatibility
  try {
    await logMessageOperation(
      'success',
      context.correlationId,
      {
        message: `New message ${message.message_id} created in chat ${message.chat.id}`,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        file_unique_id: mediaInfo.file_unique_id,
        media_group_id: message.media_group_id,
        is_forwarded: !!forwardInfo,
        forward_info: forwardInfo
      }
    );
  } catch (logError) {
    console.error('Error logging message operation:', logError);
  }

  // Process the new message based on caption presence
  await processMessage(message, insertedMessage, context);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function processMessage(
  message: TelegramMessage, 
  dbMessage: { id: string }, 
  context: MessageContext
): Promise<void> {
  // Handle media group message with no caption - try to sync content from group
  if (!message.caption && message.media_group_id && dbMessage) {
    console.log(`Message ${dbMessage.id} has no caption but is part of media group ${message.media_group_id}, checking for analyzed content in group`);
    
    try {
      // Use the proper function to check and sync with media group
      const { data: syncResult, error: syncError } = await supabaseClient.rpc(
        'xdelo_check_media_group_content',
        {
          p_media_group_id: message.media_group_id,
          p_message_id: dbMessage.id,
          p_correlation_id: context.correlationId
        }
      );
      
      if (syncError) {
        console.error('Error checking media group content:', syncError);
        
        // Fallback: Try to sync directly from the database
        await syncFromMediaGroupDirect(message.media_group_id, dbMessage.id, context.correlationId);
      } else if (syncResult && syncResult.success) {
        console.log(`Successfully synced content from media group ${message.media_group_id} to message ${dbMessage.id}`);
      } else if (syncResult) {
        console.log(`No content to sync: ${syncResult.reason}`);
        
        // If no content to sync, set a delayed re-check
        console.log(`Scheduling a delayed re-check for media group ${message.media_group_id} after 10 seconds`);
        setTimeout(async () => {
          try {
            console.log(`Performing delayed re-check for message ${dbMessage.id} in group ${message.media_group_id}`);
            await supabaseClient.rpc(
              'xdelo_check_media_group_content',
              {
                p_media_group_id: message.media_group_id,
                p_message_id: dbMessage.id,
                p_correlation_id: context.correlationId
              }
            );
          } catch (delayedError) {
            console.error('Delayed media group check failed:', delayedError);
          }
        }, 10000);
      }
    } catch (syncError) {
      console.error('Failed to sync with media group:', syncError);
    }
  }
  // If message has caption, process it immediately
  else if (message.caption && dbMessage) {
    console.log(`Message ${dbMessage.id} has caption, calling manual caption parser`);
    
    try {
      // First try direct caption processor with our new manual-caption-parser
      // Note the addition of the force_reprocess: true flag to ensure we always process
      try {
        const { data: processorResult, error: processorError } = await supabaseClient.functions.invoke(
          'manual-caption-parser',
          {
            body: {
              messageId: dbMessage.id,
              caption: message.caption,
              media_group_id: message.media_group_id,
              correlationId: context.correlationId,
              trigger_source: 'webhook_handler',
              force_reprocess: true // Force reprocessing always for new messages
            }
          }
        );
        
        if (processorError) {
          throw new Error(`Manual parser error: ${processorError.message}`);
        }
        
        console.log('Manual caption processing successful:', processorResult);
      } catch (directError) {
        console.error('Manual caption processor failed, falling back to database function:', directError);
        
        // Fallback: Call the database function directly
        const { data: captionResult, error: captionError } = await supabaseClient.rpc(
          'xdelo_analyze_message_caption',
          {
            p_message_id: dbMessage.id,
            p_correlation_id: context.correlationId,
            p_caption: message.caption,
            p_media_group_id: message.media_group_id,
            p_force_reprocess: true // Add force reprocess parameter
          }
        );
        
        if (captionError) {
          console.error('Database caption processing failed:', captionError);
        } else {
          console.log('Database caption processing successful:', captionResult);
        }
      }
    } catch (processingError) {
      console.error('Error in message processing:', processingError);
    }
  }
}

async function syncFromMediaGroupDirect(
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
    try {
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
    } catch (logError) {
      console.error('Error logging media group sync operation:', logError);
      
      // Fallback to legacy logging if new logging fails
      try {
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: 'media_group_content_synced_direct',
          entity_id: targetMessageId,
          metadata: {
            media_group_id: mediaGroupId,
            source_message_id: source.id,
            correlation_id: correlationId
          },
          event_timestamp: new Date().toISOString()
        });
      } catch (fallbackLogError) {
        console.error('Error logging direct media group sync:', fallbackLogError);
      }
    }
    
    console.log(`Successfully synced content from message ${source.id} to message ${targetMessageId}`);
    return true;
  } catch (error) {
    console.error('Error in syncFromMediaGroupDirect:', error);
    return false;
  }
}

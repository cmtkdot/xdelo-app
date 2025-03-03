
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
    // Log error event
    try {
      await logMessageOperation(
        'error',
        context.correlationId,
        {
          message: 'Error handling media message',
          error_message: error.message,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          error_code: error.code,
          processing_stage: 'media_handling'
        }
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
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      new_caption: message.caption,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
    });
    
    // Check if caption changed
    const captionChanged = message.caption !== existingMessage.caption;
    
    // Update the message with new caption and edit history
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
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
        group_caption_synced: captionChanged && message.media_group_id ? false : existingMessage.group_caption_synced
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    // If caption changed and part of a media group, update group caption sync
    if (captionChanged && message.media_group_id) {
      try {
        console.log(`Syncing edited caption to media group ${message.media_group_id}`);
        
        // Call the DB function with parameters in correct order
        const { data: syncResult, error: syncError } = await supabaseClient.rpc(
          'xdelo_sync_media_group_content',
          {
            p_source_message_id: existingMessage.id,
            p_media_group_id: message.media_group_id,
            p_correlation_id: correlationId
          }
        );
        
        if (syncError) {
          console.error('Error syncing media group caption:', syncError);
          
          // Try fallback method - direct DB updates
          try {
            await syncMediaGroupDirectly(message.media_group_id, existingMessage.id, correlationId);
          } catch (directError) {
            console.error('Direct media group sync also failed:', directError);
          }
        } else {
          console.log('Media group sync completed successfully:', syncResult);
        }
      } catch (syncError) {
        console.error('Failed to sync media group caption:', syncError);
      }
    }

    // If caption changed, trigger parsing
    if (captionChanged && message.caption) {
      try {
        // Queue the message for processing
        const { data: queueResult, error: queueError } = await supabaseClient.rpc(
          'xdelo_queue_message_for_processing',
          {
            p_message_id: existingMessage.id,
            p_correlation_id: correlationId
          }
        );
        
        if (queueError) {
          console.error('Failed to queue message for processing:', queueError);
        } else {
          console.log('Message queued for processing:', queueResult);
        }
      } catch (analysisError) {
        console.error('Failed to queue edited message for processing:', analysisError);
      }
    }

    // Log the edit event
    try {
      await logMessageOperation(
        'edit',
        context.correlationId,
        {
          message: `Message ${message.message_id} edited in chat ${message.chat.id}`,
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          file_unique_id: mediaInfo.file_unique_id,
          existing_message_id: existingMessage.id,
          edit_type: captionChanged ? 'caption_changed' : 'other_edit',
          media_group_id: message.media_group_id
        }
      );
    } catch (logError) {
      console.error('Error logging edit operation:', logError);
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

  // IMPORTANT: Check for duplicate message by file_unique_id before creating new record
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
    
    // Update the existing message
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
        // Preserve existing storage path and public URL
        storage_path: existingMessage.storage_path,
        public_url: existingMessage.public_url,
        // Reset processing if caption changed
        processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
        analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
        updated_at: new Date().toISOString(),
        is_duplicate: true
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    // Log the duplicate detection
    await logMessageOperation(
      'success',
      context.correlationId,
      {
        message: `Duplicate message detected with file_unique_id ${mediaInfo.file_unique_id}`,
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        file_unique_id: mediaInfo.file_unique_id,
        existing_message_id: existingMessage.id,
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

  // Log the insert event
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

// Unified message processing for new and duplicate messages
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
          p_message_id: dbMessage.id
        }
      );
      
      if (syncError) {
        console.error('Error checking media group content:', syncError);
      } else if (syncResult && syncResult.success) {
        console.log(`Successfully synced content from media group ${message.media_group_id} to message ${dbMessage.id}`);
      } else if (syncResult) {
        console.log(`No content to sync: ${syncResult.reason}`);
      }
    } catch (syncError) {
      console.error('Failed to sync with media group:', syncError);
    }
  }
  // If message has caption, queue for analysis
  else if (message.caption && dbMessage) {
    console.log(`Message ${dbMessage.id} has caption, queueing for analysis`);
    
    try {
      // Queue the message for processing using database function
      const { data: queueResult, error: queueError } = await supabaseClient.rpc(
        'xdelo_queue_message_for_processing',
        {
          p_message_id: dbMessage.id,
          p_correlation_id: context.correlationId
        }
      );
      
      if (queueError) {
        console.error('Failed to queue message for processing:', queueError);
        
        // Fallback: call the parse-caption-with-ai function directly
        try {
          await supabaseClient.functions.invoke('parse-caption-with-ai', {
            body: {
              messageId: dbMessage.id,
              caption: message.caption,
              media_group_id: message.media_group_id,
              correlationId: context.correlationId
            }
          });
          console.log('Direct caption analysis triggered as fallback');
        } catch (analysisError) {
          console.error('Fallback caption analysis also failed:', analysisError);
        }
      } else {
        console.log('Message successfully queued for processing:', queueResult);
      }
    } catch (queueError) {
      console.error('Error in message processing queue:', queueError);
    }
  }
}

// Helper function to sync media group directly when RPC fails
async function syncMediaGroupDirectly(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
): Promise<void> {
  try {
    console.log(`Direct sync: Getting source message ${sourceMessageId}`);
    
    // Get the analyzed content from the source message
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content')
      .eq('id', sourceMessageId)
      .single();
    
    if (sourceError || !sourceMessage?.analyzed_content) {
      console.error('Source message has no analyzed_content:', sourceError);
      return;
    }
    
    // Mark this message as the original caption holder
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        is_original_caption: true,
        group_caption_synced: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceMessageId);
      
    if (updateError) {
      console.error('Error updating source message:', updateError);
    }
    
    console.log(`Direct sync: Getting other messages in group ${mediaGroupId}`);
    
    // Get all other messages in the group
    const { data: groupMessages, error: groupError } = await supabaseClient
      .from('messages')
      .select('id, analyzed_content')
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
    
    if (groupError) {
      console.error('Error fetching group messages:', groupError);
      return;
    }
    
    if (!groupMessages?.length) {
      console.log('No other messages in the group to sync');
      return;
    }
    
    console.log(`Direct sync: Updating ${groupMessages.length} other messages`);
    
    // Update all other messages in the group
    for (const message of groupMessages) {
      try {
        const { error: msgUpdateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: sourceMessage.analyzed_content,
            message_caption_id: sourceMessageId,
            is_original_caption: false,
            group_caption_synced: true,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
          
        if (msgUpdateError) {
          console.error(`Error updating message ${message.id}:`, msgUpdateError);
        }
      } catch (updateError) {
        console.error(`Exception updating message ${message.id}:`, updateError);
      }
    }
    
    // Log the sync operation
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'media_group_content_synced',
        entity_id: sourceMessageId,
        metadata: {
          media_group_id: mediaGroupId,
          updated_count: groupMessages.length,
          operation: 'direct_sync',
          correlation_id: correlationId
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging media group sync:', logError);
    }
    
    console.log(`Direct sync: Successfully updated ${groupMessages.length} messages in group ${mediaGroupId}`);
  } catch (error) {
    console.error('Error in syncMediaGroupDirectly:', error);
  }
}

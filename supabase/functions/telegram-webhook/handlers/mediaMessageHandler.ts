
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

    // Handle new message or untracked edit
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
        processing_state: message.caption !== existingMessage.caption ? 'pending' : existingMessage.processing_state
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    // If caption changed, trigger parsing
    if (message.caption !== existingMessage.caption && message.caption) {
      try {
        // Call the parse-caption-with-ai function
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            messageId: existingMessage.id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: correlationId,
            isEdit: true
          }
        });
      } catch (analysisError) {
        console.error('Failed to trigger caption analysis for edited message:', analysisError);
        // Continue with the update regardless of analysis success
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
          edit_type: message.caption !== existingMessage.caption ? 'caption_changed' : 'other_edit',
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

  // Process the message based on caption presence
  await processNewMessage(message, insertedMessage, context);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function processNewMessage(
  message: TelegramMessage, 
  insertedMessage: { id: string }, 
  context: MessageContext
): Promise<void> {
  // Handle media group message with no caption - try to sync content from group
  if (!message.caption && message.media_group_id && insertedMessage) {
    console.log(`Message ${insertedMessage.id} has no caption but is part of media group ${message.media_group_id}, checking for analyzed content in group`);
    
    try {
      // Call database function to sync with media group
      const { data: syncResult, error: syncError } = await supabaseClient.rpc(
        'xdelo_check_media_group_content',
        {
          p_media_group_id: message.media_group_id,
          p_message_id: insertedMessage.id
        }
      );
      
      if (syncError) {
        console.error('Error checking media group content:', syncError);
      } else if (syncResult) {
        console.log(`Successfully synced content from media group ${message.media_group_id} to message ${insertedMessage.id}`);
      }
    } catch (syncError) {
      console.error('Failed to sync with media group:', syncError);
    }
  }
  // If message has caption, trigger immediate analysis
  else if (message.caption && insertedMessage) {
    console.log(`Message ${insertedMessage.id} has caption, triggering immediate analysis`);
    
    try {
      // Call the parse-caption-with-ai function directly with required parameters
      await supabaseClient.functions.invoke('parse-caption-with-ai', {
        body: {
          messageId: insertedMessage.id,
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlationId: context.correlationId
        }
      });
    } catch (analysisError) {
      console.error('Failed to trigger caption analysis:', analysisError);
      // Don't throw here - we already stored the message, so let's continue
    }
  }
}

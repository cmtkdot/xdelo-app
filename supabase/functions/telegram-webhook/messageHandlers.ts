import { supabase } from './dbOperations';
import { TelegramMessage, MessageEvent } from './types';
import { SupabaseClient } from "@supabase/supabase-js";
import { 
  TelegramDocument,
  TelegramPhoto 
} from './types';
import { getLogger } from './logger';
import { corsHeaders } from './corsHeaders';

export const handleMessage = async (
  message: TelegramMessage, 
  supabase: SupabaseClient,
  correlationId: string
) => {
  const logger = getLogger(correlationId);
  
  try {
    // Store raw webhook data with correlation ID
    await supabase.from('other_messages').insert({
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      telegram_message_id: message.message_id,
      message_type: 'text',
      telegram_data: message,
      processing_correlation_id: correlationId, // Add correlation ID
      created_at: new Date().toISOString()
    });

    if (message.photo || message.document) {
      const mediaInfo = extractMediaInfo(message);
      const messageData = {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        caption: message.caption,
        media_group_id: message.media_group_id,
        processing_correlation_id: correlationId, // Add correlation ID
        processing_state: 'pending',
        telegram_data: message,
        ...mediaInfo && {
          file_id: mediaInfo.fileId,
          file_unique_id: mediaInfo.fileUniqueId,
          mime_type: mediaInfo.mimeType,
          file_size: mediaInfo.fileSize,
          width: mediaInfo.width,
          height: mediaInfo.height
        }
      };

      // Insert into messages table
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) {
        logger.error('Error inserting message', { error: insertError });
        throw insertError;
      }

      // If has caption, trigger analysis
      if (message.caption) {
        await triggerAnalysis(
          message.message_id,
          correlationId,
          supabase,
          message.media_group_id
        );
      }

      logger.info('Message processed successfully', {
        messageId: newMessage.id,
        mediaGroupId: message.media_group_id
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          messageId: newMessage.id,
          correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        correlationId,
        message: 'Non-media message stored' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error handling message', { error });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlationId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

const getTelegramFilePublicURL = async (fileId: string): Promise<string | undefined> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-telegram-file', {
      body: { file_id: fileId },
    });

    if (error) {
      console.error('Error invoking get-telegram-file function:', error);
      return undefined;
    }

    if (data && data.file_path) {
      const filePath = data.file_path;
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    } else {
      console.warn('No file_path received from get-telegram-file function.');
      return undefined;
    }
  } catch (error) {
    console.error('Error getting Telegram file public URL:', error);
    return undefined;
  }
};

// Helper to extract media info
const extractMediaInfo = (message: TelegramMessage) => {
  if (message.photo) {
    const largestPhoto = message.photo.reduce((prev, current) => 
      (prev.width * prev.height > current.width * current.height) ? prev : current
    );
    return {
      fileId: largestPhoto.file_id,
      fileUniqueId: largestPhoto.file_unique_id,
      mimeType: 'image/jpeg',
      width: largestPhoto.width,
      height: largestPhoto.height,
      fileSize: largestPhoto.file_size
    };
  }
  
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size
    };
  }
  
  return null;
};

// Handle edited messages (both regular and channel posts)
export const handleEditedMessage = async (
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) => {
  const logger = getLogger(correlationId);
  
  try {
    // Find original message
    const { data: existingMessage, error: selectError } = await supabase
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (selectError) {
      logger.error('Error finding original message', { error: selectError });
      return new Response(
        JSON.stringify({ success: false, error: 'Original message not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build edit history
    const editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date(message.edit_date! * 1000).toISOString(),
      previous_content: {
        caption: existingMessage.caption,
        // Add any other fields you want to track
      },
      new_content: {
        caption: message.caption,
        // Add any other fields you want to track
      }
    });

    // Extract media info if present
    const mediaInfo = extractMediaInfo(message);

    // Update message with all new data
    const updateData = {
      caption: message.caption,
      is_edited: true,
      edit_date: new Date(message.edit_date! * 1000).toISOString(),
      edit_history: editHistory,
      telegram_data: message,
      processing_state: 'pending', // Always set to pending to trigger reprocessing
      processing_correlation_id: correlationId,
      updated_at: new Date().toISOString(),
      // Include media info if present
      ...mediaInfo && {
        file_id: mediaInfo.fileId,
        file_unique_id: mediaInfo.fileUniqueId,
        mime_type: mediaInfo.mimeType,
        file_size: mediaInfo.fileSize,
        width: mediaInfo.width,
        height: mediaInfo.height
      }
    };

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', existingMessage.id);

    if (updateError) {
      logger.error('Error updating edited message', { error: updateError });
      throw updateError;
    }

    // Always trigger analysis for edited messages
    await triggerAnalysis(
      message.message_id,
      correlationId,
      supabase,
      message.media_group_id
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: existingMessage.id,
        correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error handling edited message', { error });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// We can now use the same handler for both edited messages and edited channel posts
export const handleEditedChannelPost = async (
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) => {
  // Add is_channel_post flag to the message
  message.is_channel_post = true;
  return handleEditedMessage(message, supabase, correlationId);
};

// Handle channel posts
export const handleChannelPost = async (
  supabase: SupabaseClient,
  message: TelegramMessage
) => {
  const mediaInfo = extractMediaInfo(message);
  
  const messageData = {
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    chat_type: message.chat.type,
    chat_title: message.chat.title,
    caption: message.caption,
    is_channel_post: true,
    sender_chat_id: message.sender_chat?.id,
    telegram_data: message,
    ...mediaInfo && {
      file_id: mediaInfo.fileId,
      file_unique_id: mediaInfo.fileUniqueId,
      mime_type: mediaInfo.mimeType,
      file_size: mediaInfo.fileSize,
      width: mediaInfo.width,
      height: mediaInfo.height
    }
  };

  const { error } = await supabase
    .from('messages')
    .insert(messageData);

  if (error) {
    console.error('Error storing channel post:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

export const handleDeleteMessage = async (event: any) => {
  try {
    const messageId = event.message_id;
    const chatId = event.chat.id;

    // Find the original message in the database
    const { data: existingMessage, error: selectError } = await supabase
      .from('messages')
      .select('*')
      .eq('telegram_message_id', messageId)
      .eq('chat_id', chatId)
      .single();

    if (selectError) {
      console.error('Error fetching original message:', selectError);
      return { statusCode: 500, body: 'Error fetching original message' };
    }

    if (!existingMessage) {
      console.warn('Original message not found in database.');
      return { statusCode: 404, body: 'Original message not found' };
    }

    // Move the message to the deleted_messages table
    const { error: insertError } = await supabase
      .from('deleted_messages')
      .insert([{
        ...existingMessage,
        deleted_at: new Date().toISOString(),
        original_message_id: existingMessage.id,
      }]);

    if (insertError) {
      console.error('Error moving message to deleted_messages table:', insertError);
      return { statusCode: 500, body: 'Error moving message to deleted_messages table' };
    }

    // Delete the original message from the messages table
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('telegram_message_id', messageId)
      .eq('chat_id', chatId);

    if (deleteError) {
      console.error('Error deleting message from messages table:', deleteError);
      return { statusCode: 500, body: 'Error deleting message from messages table' };
    }

    return { statusCode: 200, body: 'Delete message processed successfully' };
  } catch (error) {
    console.error('Error handling delete message:', error);
    return { statusCode: 500, body: 'Error handling delete message' };
  }
};

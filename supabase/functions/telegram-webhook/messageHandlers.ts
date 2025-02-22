import { supabase } from './dbOperations';
import { TelegramMessage, MessageEvent } from './types';
import { SupabaseClient } from "@supabase/supabase-js";
import { 
  TelegramDocument,
  TelegramPhoto 
} from './types';
import { getLogger } from './logger';
import { corsHeaders } from './corsHeaders';
import { triggerAnalysis } from './analysisHandler';

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
      
      // If no caption but part of media group, check for existing analyzed content
      if (!message.caption && message.media_group_id) {
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', message.media_group_id)
          .order('created_at', { ascending: true });

        // Find first message with analyzed content
        const analyzedMessage = groupMessages?.find(m => m.analyzed_content);
        
        if (analyzedMessage) {
          logger.info('Found existing analyzed content in media group', {
            mediaGroupId: message.media_group_id,
            sourceMessageId: analyzedMessage.id
          });

          const messageData = {
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title,
            media_group_id: message.media_group_id,
            caption: analyzedMessage.caption,
            message_caption_id: analyzedMessage.id,
            is_original_caption: false,
            group_caption_synced: true,
            analyzed_content: analyzedMessage.analyzed_content,
            processing_state: 'completed',
            processing_correlation_id: correlationId,
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

          const { data: newMessage, error: insertError } = await supabase
            .from('messages')
            .insert(messageData)
            .select()
            .single();

          if (insertError) {
            logger.error('Error inserting message with group analysis', { error: insertError });
            throw insertError;
          }

          return new Response(
            JSON.stringify({ 
              success: true,
              messageId: newMessage.id,
              correlationId,
              synced: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Continue with normal message processing if no group analysis found
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
      await triggerAnalysis(
        message.message_id,
        correlationId,
        supabase,
        message.media_group_id
      );

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

    // Update edit history
    const editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date(message.edit_date! * 1000).toISOString(),
      previous_content: {
        caption: existingMessage.caption
      },
      new_content: {
        caption: message.caption
      }
    });

    // Update message with all new data
    const updateData = {
      caption: message.caption,
      is_edited: true,
      edit_date: new Date(message.edit_date! * 1000).toISOString(),
      edit_history: editHistory,
      telegram_data: message,
      processing_state: 'pending', // Always reprocess
      processing_correlation_id: correlationId,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', existingMessage.id);

    if (updateError) {
      logger.error('Error updating message', { error: updateError });
      throw updateError;
    }

    // Always trigger analysis for edits
    await triggerAnalysis(
      message.message_id,
      correlationId,
      supabase,
      message.media_group_id
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error handling edit', { error });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

export const handleDeleteMessage = async (
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
) => {
  const { error } = await supabase
    .from('messages')
    .update({ 
      processing_state: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id);

  if (error) throw error;
};

const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
  throw new Error('All retries failed');
};

const validateMessage = (message: TelegramMessage) => {
  if (!message.chat?.id) throw new Error('Missing chat ID');
  if (!message.message_id) throw new Error('Missing message ID');
  if (message.media_group_id && !message.photo && !message.document) {
    throw new Error('Invalid media group message');
  }
};

// 3. Add media group completion check
const checkMediaGroupCompletion = async (
  mediaGroupId: string,
  supabase: SupabaseClient
) => {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId);

  if (messages?.every(m => m.processing_state === 'completed')) {
    await supabase
      .from('messages')
      .update({
        group_completed_at: new Date().toISOString()
      })
      .eq('media_group_id', mediaGroupId);
  }
};

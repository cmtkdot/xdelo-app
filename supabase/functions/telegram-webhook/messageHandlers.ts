import { supabase } from './dbOperations';
import { TelegramMessage, MessageEvent } from './types';

export const handleMessage = async (event: MessageEvent) => {
  try {
    // Store raw webhook data in other_messages as fallback
    await supabase.from('other_messages').insert({
      chat_id: event.message.chat.id,
      chat_type: event.message.chat.type,
      chat_title: event.message.chat.title,
      telegram_message_id: event.message.message_id,
      message_type: 'text',
      telegram_data: event.message // Store complete webhook data
    });

    // Continue with normal message processing
    if (event.message.photo || event.message.document) {
      // Process media message
      const message = event.message as TelegramMessage;
      const mediaGroupId = message.media_group_id;

      // Determine fileId and fileUniqueId based on whether it's a photo or document
      let fileId: string | undefined;
      let fileUniqueId: string | undefined;
      let publicUrl: string | undefined;
      let mimeType: string | undefined;
      let fileSize: number | undefined;
      let width: number | undefined;
      let height: number | undefined;
      let duration: number | undefined;

      if (message.photo) {
        const largestPhoto = message.photo.reduce((prev, current) => {
          return (prev.width * prev.height > current.width * current.height) ? prev : current;
        });

        fileId = largestPhoto.file_id;
        fileUniqueId = largestPhoto.file_unique_id;
        mimeType = 'image/jpeg'; // Assume JPEG for photos
        fileSize = largestPhoto.file_size;
        width = largestPhoto.width;
        height = largestPhoto.height;

        if (fileId) {
          publicUrl = await getTelegramFilePublicURL(fileId);
        }
      } else if (message.document) {
        fileId = message.document.file_id;
        fileUniqueId = message.document.file_unique_id;
        mimeType = message.document.mime_type;
        fileSize = message.document.file_size;
        width = message.document.width;
        height = message.document.height;
        duration = message.document.duration;

        if (fileId) {
          publicUrl = await getTelegramFilePublicURL(fileId);
        }
      }

      if (!fileId || !fileUniqueId) {
        console.warn('No file_id or file_unique_id found in message:', message);
        return { statusCode: 400, body: 'No file_id or file_unique_id found in message' };
      }

      // Check if the message already exists
      const { data: existingMessage, error: selectError } = await supabase
        .from('messages')
        .select('*')
        .eq('file_unique_id', fileUniqueId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // Ignore "no data found" error
        console.error('Error checking for existing message:', selectError);
        throw selectError;
      }

      if (existingMessage) {
        console.log('Message already exists, skipping storage.');
        return { statusCode: 200, body: 'Message already exists' };
      }

      // Extract chat information
      const chatId = message.chat.id;
      const chatType = message.chat.type;
      const chatTitle = message.chat.title;

      // Construct the base message object
      const baseMessageObject = {
        id: crypto.randomUUID(),
        telegram_message_id: message.message_id,
        media_group_id: mediaGroupId || null,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        public_url: publicUrl,
        mime_type: mimeType,
        file_size: fileSize,
        width: width,
        height: height,
        duration: duration,
        user_id: message.from?.id.toString(),
        chat_id: chatId,
        chat_type: chatType,
        chat_title: chatTitle,
        telegram_data: message,
      };

      // Add caption details if available
      if (message.caption) {
        await supabase.from('messages').insert({
          ...baseMessageObject,
          caption: message.caption,
        });
      } else {
        // If no caption, store the message without a caption
        await supabase.from('messages').insert(baseMessageObject);
      }

      return { statusCode: 200, body: 'Media message processed successfully' };
    }

    return { statusCode: 200, body: 'Message processed successfully' };
  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
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

export const handleEditedMessage = async (event: MessageEvent) => {
  try {
    const message = event.message as TelegramMessage;
    const telegramMessageId = message.message_id;
    const chatId = message.chat.id;

    // Find the original message in the database
    const { data: existingMessage, error: selectError } = await supabase
      .from('messages')
      .select('*')
      .eq('telegram_message_id', telegramMessageId)
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

    // Update the message with the new caption
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption: message.caption,
        edit_date: new Date().toISOString(),
        telegram_data: message,
      })
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId);

    if (updateError) {
      console.error('Error updating message caption:', updateError);
      return { statusCode: 500, body: 'Error updating message caption' };
    }

    return { statusCode: 200, body: 'Edit message processed successfully' };
  } catch (error) {
    console.error('Error handling edited message:', error);
    return { statusCode: 500, body: 'Error handling edited message' };
  }
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

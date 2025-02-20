import { createClient } from '@supabase/supabase-js';

// Helper function to create Supabase client
const createSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
};

export const handleMessage = async (message: any) => {
  const supabase = createSupabaseClient();

  // Extract message details
  const messageId = message.message_id;
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const mediaGroupId = message.media_group_id;
  const caption = message.caption || '';
  const editDate = message.edit_date;

  // Handle different types of media
  const photo = message.photo?.[message.photo.length - 1];  // Get largest photo
  const video = message.video;
  const document = message.document;

  let fileId, fileUniqueId, mimeType, fileSize, width, height, duration;

  if (photo) {
    fileId = photo.file_id;
    fileUniqueId = photo.file_unique_id;
    mimeType = 'image/jpeg';
    fileSize = photo.file_size;
    width = photo.width;
    height = photo.height;
  } else if (video) {
    fileId = video.file_id;
    fileUniqueId = video.file_unique_id;
    mimeType = video.mime_type;
    fileSize = video.file_size;
    width = video.width;
    height = video.height;
    duration = video.duration;
  } else if (document) {
    fileId = document.file_id;
    fileUniqueId = document.file_unique_id;
    mimeType = document.mime_type;
    fileSize = document.file_size;
  }

  if (!fileId) {
    console.log('No media found in message:', message);
    return;
  }

  try {
    const { data: existingMessage, error: checkError } = await supabase
      .from('messages')
      .select('id, processing_state')
      .eq('telegram_message_id', messageId)
      .eq('chat_id', chatId)
      .single();

    if (existingMessage) {
      // Update existing message if edited
      if (editDate) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            caption,
            telegram_data: message,
            processing_state: 'pending', // Reset to pending to trigger reanalysis
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);

        if (updateError) throw updateError;

        // Trigger reanalysis
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            message_id: existingMessage.id,
            caption: caption
          }
        });
      }
      console.log('Message handled:', existingMessage.id);
      return;
    }

    // Insert new message
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        telegram_message_id: messageId,
        media_group_id: mediaGroupId,
        caption,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        mime_type: mimeType,
        file_size: fileSize,
        width,
        height,
        duration,
        chat_id: chatId,
        chat_type: chatType,
        telegram_data: message,
        processing_state: caption ? 'pending' : 'completed',
        user_id: message.from?.id?.toString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (caption) {
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          message_id: insertedMessage.id,
          caption: caption
        }
      });
    }

    console.log('Message processed successfully:', insertedMessage.id);

  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
};

import { createClient } from '@supabase/supabase-js';
import { Database } from '../_shared/database.types.ts';

// Helper function to create Supabase client
const createSupabaseClient = () => {
  return createClient<Database>(
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
      .select('id')
      .eq('file_unique_id', fileUniqueId)
      .single();

    if (existingMessage) {
      console.log('Message already exists:', existingMessage.id);
      return;
    }

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

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
          messageId: insertedMessage.id,
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

export const handleChatMemberUpdate = async (update: any) => {
  // Defensive check for required fields
  if (!update?.chat_member?.chat?.id) {
    console.error('Missing required chat member update fields:', update);
    return;
  }

  const chatId = update.chat_member.chat.id;
  const chatType = update.chat_member.chat.type;
  const newChatMember = update.chat_member.new_chat_member;
  const oldChatMember = update.chat_member.old_chat_member;

  console.log('Processing chat member update:', {
    chatId,
    chatType,
    newStatus: newChatMember?.status,
    oldStatus: oldChatMember?.status
  });

  const supabase = createSupabaseClient();

  try {
    await supabase.from('other_messages').insert({
      chat_id: chatId,
      chat_type: chatType,
      message_type: 'chat_member_update',
      telegram_data: update
    });

    console.log('Chat member update logged successfully');
  } catch (error) {
    console.error('Error logging chat member update:', error);
    throw error;
  }
};

export const handleEditedMessage = async (message: any) => {
  const supabase = createSupabaseClient();
  
  try {
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (fetchError) {
      console.error('Error fetching existing message:', fetchError);
      return;
    }

    if (!existingMessage) {
      console.log('Original message not found for edit');
      return;
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption: message.caption || '',
        telegram_data: message,
        processing_state: message.caption ? 'pending' : 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMessage.id);

    if (updateError) throw updateError;

    if (message.caption) {
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: existingMessage.id,
          caption: message.caption
        }
      });
    }

    console.log('Edited message processed successfully');

  } catch (error) {
    console.error('Error processing edited message:', error);
    throw error;
  }
};

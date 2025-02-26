import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';

serve(async (req) => {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message: messageData, my_chat_member: chatMemberData } = await req.json();

    // Determine if the update is a message or a chat member update
    const isMessage = messageData !== undefined;
    const isChatMember = chatMemberData !== undefined;

    console.log('Received Telegram update:', {
      isMessage,
      isChatMember,
      messageType: messageData?.chat?.type,
      chatId: messageData?.chat?.id,
      messageId: messageData?.message_id,
      chatMemberUpdateType: chatMemberData?.update_id
    });

    if (isChatMember) {
      const chatId = chatMemberData.chat.id;
      const chatType = chatMemberData.chat.type;
      const chatTitle = chatMemberData.chat.title;

      console.log('Processing chat member update:', { chatId, chatType, chatTitle });

      // Log chat details to Supabase
      const { data: existingChat, error: selectError } = await supabaseClient
        .from('chats')
        .select('*')
        .eq('chat_id', chatId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error selecting chat:', selectError);
        throw selectError;
      }

      if (!existingChat) {
        const { error: insertError } = await supabaseClient
          .from('chats')
          .insert({ chat_id: chatId, chat_type: chatType, chat_title: chatTitle });

        if (insertError) {
          console.error('Error inserting chat:', insertError);
          throw insertError;
        }

        console.log('Inserted new chat:', { chatId, chatType, chatTitle });
      } else {
        console.log('Chat already exists:', { chatId, chatType, chatTitle });
      }

      return new Response(JSON.stringify({ message: 'Chat member update processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!isMessage) {
      console.log('No message to process, skipping.');
      return new Response(JSON.stringify({ message: 'No message to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const chatId = messageData.chat.id;
    const chatType = messageData.chat.type;
    const chatTitle = messageData.chat.title;
    const telegramMessageId = messageData.message_id;
    const messageText = messageData.text || messageData.caption || '';
    const correlationId = crypto.randomUUID();

    console.log('Processing message:', { chatId, chatType, telegramMessageId, correlationId });

    // Extract media information
    let media = null;
    if (messageData.photo) {
      const photo = messageData.photo.reduce((prev, current) => (prev.file_size > current.file_size) ? prev : current);
      media = {
        file_id: photo.file_id,
        file_unique_id: photo.file_unique_id,
        width: photo.width,
        height: photo.height,
        mime_type: 'image/jpeg', // Assume JPEG as default for photos
        file_size: photo.file_size,
      };
    } else if (messageData.document) {
      media = {
        file_id: messageData.document.file_id,
        file_unique_id: messageData.document.file_unique_id,
        file_name: messageData.document.file_name,
        mime_type: messageData.document.mime_type,
        file_size: messageData.document.file_size,
      };
    } else if (messageData.video) {
      media = {
        file_id: messageData.video.file_id,
        file_unique_id: messageData.video.file_unique_id,
        width: messageData.video.width,
        height: messageData.video.height,
        duration: messageData.video.duration,
        mime_type: messageData.video.mime_type,
        file_size: messageData.video.file_size,
      };
    } else if (messageData.audio) {
      media = {
        file_id: messageData.audio.file_id,
        file_unique_id: messageData.audio.file_unique_id,
        duration: messageData.audio.duration,
        mime_type: messageData.audio.mime_type,
        file_size: messageData.audio.file_size,
      };
    }

    let publicURL = null;
    let storagePath = null;

    if (media) {
      console.log('Media detected, attempting to upload:', { file_id: media.file_id, file_unique_id: media.file_unique_id });

      // Check if the media already exists
      const { data: existingMedia, error: selectError } = await supabaseClient
        .from('messages')
        .select('public_url, storage_path')
        .eq('file_unique_id', media.file_unique_id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error selecting media:', selectError);
        throw selectError;
      }

      if (existingMedia) {
        console.log('Media already exists, reusing URL:', { public_url: existingMedia.public_url, storage_path: existingMedia.storage_path });
        publicURL = existingMedia.public_url;
        storagePath = existingMedia.storage_path;
      } else {
        // Download the file from Telegram
        const telegramFileUrl = `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/getFile?file_id=${media.file_id}`;
        const telegramFileResponse = await fetch(telegramFileUrl);
        const telegramFileData = await telegramFileResponse.json();

        if (!telegramFileData.ok) {
          console.error('Failed to get file from Telegram:', telegramFileData);
          throw new Error(`Failed to get file from Telegram: ${JSON.stringify(telegramFileData)}`);
        }

        const filePath = telegramFileData.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/${filePath}`;
        const fileResponse = await fetch(fileUrl);
        const fileBlob = await fileResponse.blob();
        const fileArrayBuffer = await fileBlob.arrayBuffer();
        const fileBuffer = new Uint8Array(fileArrayBuffer);

        // Determine the file extension
        let fileExtension = '';
        if (media.mime_type) {
          fileExtension = media.mime_type.split('/')[1];
        } else if (media.file_name) {
          fileExtension = media.file_name.split('.').pop();
        } else {
          fileExtension = 'jpg'; // Default to jpg
        }

        // Construct the storage path
        storagePath = `telegram_files/${chatId}/${telegramMessageId}_${media.file_unique_id}.${fileExtension}`;

        // Upload the file to Supabase storage
        const { error: storageError } = await supabaseClient
          .storage
          .from('telegram_files')
          .upload(storagePath, fileBuffer, {
            contentType: media.mime_type || 'image/jpeg',
            upsert: true
          });

        if (storageError) {
          console.error('Failed to upload file to storage:', storageError);
          throw storageError;
        }

        // Get the public URL
        const { data: urlData } = supabaseClient
          .storage
          .from('telegram_files')
          .getPublicUrl(storagePath);

        publicURL = urlData.publicUrl;
        console.log('File uploaded successfully:', { publicURL, storagePath });
      }
    }

    // Check if this is a forwarded message with media
    if (messageData.forward_from || messageData.forward_from_chat) {
      console.log('Processing forwarded message:', {
        message_id: messageData.message_id,
        forward_from: messageData.forward_from || messageData.forward_from_chat,
        has_media: !!messageData.photo || !!messageData.video || !!messageData.document
      });

      // Check for existing message with same file_unique_id
      if (media?.file_unique_id) {
        const { data: originalMessage, error: findError } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('file_unique_id', media.file_unique_id)
          .eq('is_forward', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (findError && findError.code !== 'PGRST116') { // Ignore not found error
          console.error('Error finding original message:', findError);
          throw findError;
        }

        if (originalMessage) {
          console.log('Found original message for forward:', {
            original_id: originalMessage.id,
            file_unique_id: media.file_unique_id
          });

          // Set is_forward and original_message_id in the message data
          messageData.is_forward = true;
          messageData.original_message_id = originalMessage.id;
          
          // We'll reuse the existing media's public_url and storage path
          messageData.public_url = originalMessage.public_url;
          messageData.storage_path = originalMessage.storage_path;
        }
      }
    }

    // Insert message data into Supabase
    const { error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: telegramMessageId,
        chat_id: chatId,
        chat_type: chatType,
        chat_title: chatTitle,
        message_url: `https://t.me/${chatType === 'channel' ? chatTitle : chatId}/${telegramMessageId}`,
        media_group_id: messageData.media_group_id,
        caption: messageText,
        file_id: media?.file_id,
        file_unique_id: media?.file_unique_id,
        mime_type: media?.mime_type,
        file_size: media?.file_size,
        width: media?.width,
        height: media?.height,
        duration: media?.duration,
        public_url: publicURL,
        storage_path: storagePath,
        telegram_data: messageData,
        correlation_id: correlationId,
        is_forward: messageData.is_forward || false,
        original_message_id: messageData.original_message_id || null
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    console.log('Message inserted successfully:', { telegramMessageId, chatId, correlationId });

    // Invoke the function to parse the caption with AI
    try {
      const { data, error } = await supabaseClient.functions.invoke('parse-caption-with-ai', {
        body: { messageId: telegramMessageId, caption: messageText }
      });

      if (error) {
        console.error('Error invoking function:', error);
      } else {
        console.log('Function invoked successfully:', data);
      }
    } catch (aiError) {
      console.error('Error during function invocation:', aiError);
    }

    return new Response(JSON.stringify({ message: 'Message processed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

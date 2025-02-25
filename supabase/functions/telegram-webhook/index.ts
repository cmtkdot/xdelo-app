import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

if (!supabaseUrl || !supabaseServiceRole || !telegramToken) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

async function getFileUrl(fileId: string, correlationId?: string): Promise<string> {
  const logPrefix = correlationId ? `[${correlationId}]` : '';
  console.log(`${logPrefix} 🔍 Getting file URL for fileId:`, fileId)
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
  )
  const data = await response.json()
  if (!data.ok) throw new Error('Failed to get file path')
  return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`
}

async function uploadMediaToStorage(fileUrl: string, fileUniqueId: string, mimeType: string, correlationId?: string): Promise<string> {
  const logger = (message: string, data?: any) => {
    console.log(`[${correlationId || ''}] ${message}`, data || '');
  };

  logger('Uploading media to storage', { fileUniqueId, mimeType });
  
  const ext = mimeType.split('/')[1] || 'bin'
  const storagePath = `${fileUniqueId}.${ext}`
  
  try {
    const mediaResponse = await fetch(fileUrl)
    if (!mediaResponse.ok) {
      logger('Failed to download media:', { status: mediaResponse.status });
      throw new Error('Failed to download media from Telegram')
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer()

    const { data: existingFile } = await supabase
      .storage
      .from('telegram-media')
      .list('', { 
        search: storagePath,
        limit: 1
      })

    // If file exists, get its public URL
    if (existingFile && existingFile.length > 0) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('telegram-media')
        .getPublicUrl(storagePath)
      
      logger('File already exists, returning existing URL');
      return publicUrl;
    }

    // Upload new file
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600'
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath)

    logger('Media uploaded successfully');
    return publicUrl

  } catch (error) {
    logger('Error uploading media:', error);
    throw error;
  }
}

// Helper function to create edit history entry
function createEditHistoryEntry(previousCaption: string, newCaption: string, isChannelPost: boolean): any {
  return {
    edit_date: new Date().toISOString(),
    previous_caption: previousCaption || '',
    new_caption: newCaption || '',
    is_channel_post: isChannelPost
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const logger = (message: string, data?: any) => {
    console.log(`[${correlationId}] ${message}`, data || '');
  };

  try {
    const rawBody = await req.text();
    logger('Raw request body:', rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger('Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json', correlation_id: correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Handle different message types
    const message = update.message || update.channel_post || 
                   update.edited_message || update.edited_channel_post;
    
    if (!message) {
      logger('No valid message found in update');
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no valid message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const isEdit = !!update.edited_message || !!update.edited_channel_post;
    const isChannelPost = !!update.channel_post || !!update.edited_channel_post;
    const chat = message.chat;
    const mediaGroupId = message.media_group_id;
    
    // Check for media content
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    if (!media) {
      logger('No media, storing in other_messages');
      
      // For text message edits, check if the original exists
      if (isEdit) {
        const { data: existingMessage } = await supabase
          .from('other_messages')
          .select('*')
          .eq('chat_id', chat.id)
          .eq('telegram_message_id', message.message_id)
          .single();

        if (existingMessage) {
          logger('Updating existing text message', { messageId: existingMessage.id });
          
          // Create edit history entry
          const editHistoryEntry = createEditHistoryEntry(
            existingMessage.message_text, 
            message.text, 
            isChannelPost
          );
          
          // Update existing message
          const editHistory = existingMessage.edit_history || [];
          editHistory.push(editHistoryEntry);
          
          const { error: updateError } = await supabase
            .from('other_messages')
            .update({
              message_text: message.text,
              edit_history: editHistory,
              is_edited: true,
              edit_date: new Date(message.edit_date * 1000).toISOString(),
              telegram_data: update,
              correlation_id: correlationId
            })
            .eq('id', existingMessage.id);
            
          if (updateError) throw updateError;
          
          return new Response(
            JSON.stringify({ 
              status: 'success', 
              type: 'text_message_edit',
              isChannelPost
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
          );
        }
      }
      
      // Store new text message in other_messages table
      const { error } = await supabase
        .from('other_messages')
        .insert({
          chat_id: chat.id,
          chat_type: chat.type,
          chat_title: chat.title,
          telegram_message_id: message.message_id,
          message_text: message.text,
          telegram_data: update,
          correlation_id: correlationId,
          is_channel_post: isChannelPost,
          edit_history: isEdit ? [createEditHistoryEntry('', message.text, isChannelPost)] : []
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          status: 'success', 
          type: 'text_message',
          isChannelPost
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    // Get media URL and upload to storage
    logger('Getting file URL for media', { fileId: media.file_id });
    const telegramFileUrl = await getFileUrl(media.file_id, correlationId);
    logger('Uploading media to storage', { fileUrl: telegramFileUrl });
    const storageUrl = await uploadMediaToStorage(
      telegramFileUrl,
      media.file_unique_id,
      video ? video.mime_type : 'image/jpeg',
      correlationId
    );

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '',
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: storageUrl,
      storage_path: `${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update,
      correlation_id: correlationId,
      is_edited: isEdit,
      is_channel_post: isChannelPost,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null
    };

    let resultMessage;

    if (existingMedia) {
      // Create edit history entry for caption changes
      if (isEdit && existingMedia.caption !== message.caption) {
        const editHistoryEntry = createEditHistoryEntry(
          existingMedia.caption, 
          message.caption, 
          isChannelPost
        );
        
        // Update edit history
        const editHistory = existingMedia.edit_history || [];
        editHistory.push(editHistoryEntry);
        messageData.edit_history = editHistory;
      }
      
      // Update existing record
      const { data: updated, error } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id)
        .select()
        .single();

      if (error) throw error;
      resultMessage = updated;

      // If this is an edit with changed caption, trigger reanalysis
      // Works for both regular messages and channel posts
      if (isEdit && message.caption !== existingMedia.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: existingMedia.id,
            caption: message.caption,
            correlation_id: correlationId,
            is_edit: true,
            is_channel_post: isChannelPost,
            media_group_id: mediaGroupId
          }
        });
      }
    } else {
      // Initialize edit history for new edited messages
      if (isEdit) {
        messageData.edit_history = [createEditHistoryEntry('', message.caption || '', isChannelPost)];
      }
      
      // Insert new record
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      resultMessage = inserted;

      // For new messages in a media group, check for existing analyzed content
      if (mediaGroupId) {
        const { data: analyzedMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', mediaGroupId)
          .not('analyzed_content', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (analyzedMessage?.analyzed_content) {
          await supabase
            .from('messages')
            .update({
              analyzed_content: analyzedMessage.analyzed_content,
              message_caption_id: analyzedMessage.id,
              is_original_caption: false,
              group_caption_synced: true,
              processing_state: 'completed'
            })
            .eq('id', resultMessage.id);
        }
      }

      // Trigger analysis for new messages with captions
      // Works for both regular messages and channel posts
      if (message.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: resultMessage.id,
            caption: message.caption,
            correlation_id: correlationId,
            is_channel_post: isChannelPost,
            media_group_id: mediaGroupId
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        correlation_id: correlationId,
        message: 'Message processed',
        messageId: resultMessage.id,
        isEdit,
        isChannelPost,
        hasCaption: !!message.caption,
        mediaGroupId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        correlation_id: correlationId,
        message: error.message,
        stack: error.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
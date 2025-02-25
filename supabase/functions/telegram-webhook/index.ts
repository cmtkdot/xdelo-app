import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  findExistingMessage, 
  findMessageByFileUniqueId,
  syncMediaGroupContent,
  findAnalyzedMessageInGroup
} from './utils/dbOperations.ts'
import { getLogger } from './utils/logger.ts'

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

async function getFileUrl(fileId: string): Promise<string> {
  console.log('🔍 Getting file URL for fileId:', fileId)
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
  )
  const data = await response.json()
  if (!data.ok) throw new Error('Failed to get file path')
  return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`
}

async function uploadMediaToStorage(fileUrl: string, fileUniqueId: string, mimeType: string): Promise<string> {
  console.log('📤 Uploading media to storage:', { fileUniqueId, mimeType })
  
  const ext = mimeType.split('/')[1] || 'bin'
  const storagePath = `${fileUniqueId}.${ext}`
  
  try {
    const mediaResponse = await fetch(fileUrl)
    if (!mediaResponse.ok) throw new Error('Failed to download media from Telegram')
    
    const mediaBuffer = await mediaResponse.arrayBuffer()

    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mimeType,
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath)

    console.log('✅ Media uploaded successfully:', publicUrl)
    return publicUrl

  } catch (error) {
    console.error('❌ Error uploading media:', error)
    throw error
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Generate a correlation ID for tracking this request
  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const logger = getLogger(correlationId);

  try {
    const rawBody = await req.text();
    logger.info('Raw request body received', { bodyLength: rawBody.length });

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger.error('Failed to parse JSON', { error: e.message });
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    logger.info('Parsed webhook update', { updateKeys: Object.keys(update) });
    
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    
    if (!message) {
      logger.warn('No message or channel_post in update', { updateKeys: Object.keys(update) });
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'no message or channel_post',
          update_keys: Object.keys(update),
          correlation_id: correlationId
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    logger.info('Processing message', { 
      messageId: message.message_id,
      chatId: message.chat?.id,
      hasCaption: !!message.caption,
      isEdited: !!message.edit_date
    });

    const chat = message.chat
    const mediaGroupId = message.media_group_id
    const photo = message.photo ? message.photo[message.photo.length - 1] : null
    const video = message.video
    const media = photo || video

    logger.info('Media details', {
      hasPhoto: !!photo,
      hasVideo: !!video,
      mediaGroupId,
      mediaType: photo ? 'photo' : video ? 'video' : 'none'
    });

    if (!media) {
      logger.warn('No media in message', { messageType: message.type });
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'no media',
          messageType: message.type,
          correlation_id: correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Check if this media has been processed before
    const existingMedia = await findMessageByFileUniqueId(supabase, media.file_unique_id);

    logger.info('Existing media check', {
      exists: !!existingMedia,
      fileUniqueId: media.file_unique_id,
      existingId: existingMedia?.id
    });

    let messageData = existingMedia;
    let storageUrl = existingMedia?.public_url;

    // Always process media updates
    logger.info('Processing media update');
    
    const telegramFileUrl = await getFileUrl(media.file_id)
    logger.info('Got Telegram file URL');
    
    if (!existingMedia) {
      logger.info('New media detected, uploading to storage');
      storageUrl = await uploadMediaToStorage(
        telegramFileUrl,
        media.file_unique_id,
        video ? video.mime_type : 'image/jpeg'
      )
    } else {
      logger.info('Using existing storage URL', { url: existingMedia.public_url });
      storageUrl = existingMedia.public_url;
    }
      
    const newMessageData: {
      telegram_message_id: number;
      chat_id: number;
      chat_type: string;
      chat_title: string;
      media_group_id?: string;
      caption: string;
      file_id: string;
      file_unique_id: string;
      public_url?: string;
      storage_path: string;
      mime_type: string;
      file_size?: number;
      width: number;
      height: number;
      duration?: number;
      processing_state: string;
      telegram_data: Record<string, unknown>;
      is_edited?: boolean;
      edit_date?: string;
      analyzed_content?: Record<string, unknown> | null;
    } = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '', // Store empty string if no caption
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
      telegram_data: update
    }

    // Handle edited messages
    if (message.edit_date) {
      newMessageData.is_edited = true;
      newMessageData.edit_date = new Date(message.edit_date * 1000).toISOString();
      newMessageData.analyzed_content = null; // Clear for re-analysis
      newMessageData.processing_state = message.caption ? 'pending' : 'initialized';
      if (existingMedia?.telegram_data) {
        newMessageData.telegram_data = {
          original_message: existingMedia.telegram_data.message,
          edited_message: message
        };
      }
    }

    console.log('📝 Prepared message data:', JSON.stringify(newMessageData, null, 2));

    if (existingMedia) {
      console.log('🔄 Updating existing media');
      const { data: updatedMessage, error } = await supabase
        .from('messages')
        .update(newMessageData)
        .eq('id', existingMedia.id)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error updating message:', error);
        throw error;
      }
      messageData = updatedMessage;
    } else {
      console.log('📥 Inserting new media');
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert(newMessageData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error inserting message:', error);
        throw error;
      }
      messageData = newMessage;
    }

    // Handle media group synchronization and caption analysis
    if (messageData && mediaGroupId) {
      logger.info('Message is part of a media group', { mediaGroupId });
      
      if (message.caption) {
        // This message has a caption, trigger analysis
        logger.info('Message has caption, triggering analysis', { 
          messageId: messageData.id,
          captionLength: message.caption.length
        });
        
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: messageData.id,
            caption: message.caption,
            media_group_id: mediaGroupId,
            correlation_id: correlationId
          }
        });
      } else {
        // No caption, check if any other message in the group has analyzed content
        logger.info('Message has no caption, checking group for analyzed content');
        
        const analyzedMessage = await findAnalyzedMessageInGroup(supabase, mediaGroupId!);
        
        if (analyzedMessage && analyzedMessage.analyzed_content) {
          // Found a message with analyzed content, sync it to this message
          logger.info('Found analyzed content in group, syncing to this message', {
            sourceMessageId: analyzedMessage.id,
            targetMessageId: messageData.id
          });
          
          await syncMediaGroupContent(
            supabase,
            analyzedMessage.id,
            mediaGroupId,
            analyzedMessage.analyzed_content,
            correlationId
          );
          
          logger.info('Successfully synced media group content');
        } else {
          logger.info('No analyzed content found in group yet');
        }
      }
    } else if (messageData && message.caption) {
      // Not part of a media group but has caption, trigger analysis
      logger.info('Triggering caption analysis for individual message', { messageId: messageData.id });
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: messageData.id,
          caption: message.caption,
          correlation_id: correlationId
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        message: 'Message processed',
        messageId: messageData?.id || 'unknown',
        storagePath: messageData?.storage_path || 'unknown',
        correlation_id: correlationId,
        mediaGroupId: mediaGroupId || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    logger.error('Error processing webhook', { 
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

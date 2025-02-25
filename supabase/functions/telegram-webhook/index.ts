import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { downloadMedia, extractMediaInfo } from "./mediaUtils.ts";
import { corsHeaders } from "./authUtils.ts";
import { getLogger } from "./logger.ts";
import { 
  MessageData, 
  OtherMessageData,
  EditHistoryEntry
} from "./types.ts";
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (!supabaseUrl || !supabaseServiceRole || !telegramToken) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Get file URL from Telegram
async function getFileUrl(fileId: string, token: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  if (!data.ok) throw new Error('Failed to get file path');
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

async function findAnalyzedMessageInGroup(mediaGroupId: string, correlationId: string): Promise<MessageData | null> {
  const logger = getLogger(correlationId);
  logger.info(`Looking for analyzed message in group: ${mediaGroupId}`);
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .not('analyzed_content', 'is', null)
      .limit(1);
    
    if (error) {
      logger.error(`Error finding analyzed message: ${error.message}`);
      return null;
    }
    
    if (data && data.length > 0) {
      logger.info(`Found analyzed message in group`);
      return data[0];
    }
    
    logger.info(`No analyzed message found in group`);
    return null;
  } catch (error) {
    logger.error(`Error finding analyzed message: ${error.message}`);
    return null;
  }
}

async function handleEditedCaption(
  messageId: string,
  previousCaption: string,
  newCaption: string,
  correlationId: string,
  analyzedContent: Record<string, unknown> | null,
  editDate: string,
  isChannelPost: boolean,
  mediaGroupId?: string
): Promise<void> {
  const logger = getLogger(correlationId);
  logger.info(`Handling edited caption for message ${messageId}`);
  
  try {
    // Check if this is the original caption holder for a media group
    let isOriginalCaption = false;
    if (mediaGroupId) {
      const { data: messageData } = await supabase
        .from('messages')
        .select('is_original_caption')
        .eq('id', messageId)
        .single();
        
      isOriginalCaption = messageData?.is_original_caption || false;
      
      logger.info(`Media group caption check: ${mediaGroupId}, isOriginalCaption: ${isOriginalCaption}`);
    }
    
    // Trigger re-analysis with the parse-caption-with-ai function
    const response = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { 
        messageId: messageId,
        caption: newCaption,
        previousCaption: previousCaption,
        isEdit: true,
        editDate: editDate,
        isChannelPost: isChannelPost,
        correlationId: correlationId,
        media_group_id: isOriginalCaption ? mediaGroupId : undefined // Only pass media_group_id if this is the original caption
      }
    });
    
    logger.info(`Triggered re-analysis for edited caption: success=${!!response.data?.success}`);
    
    // If this is not the original caption holder but part of a media group,
    // we need to find the original caption holder and sync from it
    if (mediaGroupId && !isOriginalCaption) {
      logger.info(`Message is part of media group but not original caption, finding caption source`);
      
      const { data: groupData } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .eq('media_group_id', mediaGroupId)
        .eq('is_original_caption', true)
        .limit(1);
        
      if (groupData && groupData.length > 0 && groupData[0].analyzed_content) {
        logger.info(`Found original caption source, syncing content`);
        
        // Update this message with the original caption's analyzed content
        await supabase
          .from('messages')
          .update({
            analyzed_content: groupData[0].analyzed_content,
            message_caption_id: groupData[0].id,
            group_caption_synced: true,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            processing_correlation_id: correlationId
          })
          .eq('id', messageId);
      }
    }
  } catch (error) {
    logger.error(`Error handling edited caption: ${error.message}`);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Generate a correlation ID for tracking this request
  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const logger = getLogger(correlationId);
  
  try {
    const rawBody = await req.text();
    logger.info(`Raw request body: ${rawBody}`);

    let update: any;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger.error(`Failed to parse JSON: ${e.message}`);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json', correlation_id: correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    logger.info(`Parsed webhook update: ${JSON.stringify(update, null, 2)}`);
    
    // Log the structure of edited_channel_post if present for debugging
    if (update.edited_channel_post) {
      logger.info(`Edited channel post structure: ${JSON.stringify({
        keys: Object.keys(update.edited_channel_post),
        hasMessageId: !!update.edited_channel_post.message_id
      })}`);
    }
    
    // Handle both regular messages and channel posts
    const message = update.message || update.channel_post || 
                    (update.edited_channel_post ? update.edited_channel_post : null) || 
                    (update.edited_message ? update.edited_message : null);
    const isEdited = Boolean(update.edited_message || update.edited_channel_post);
    const isChannelPost = Boolean(update.channel_post || update.edited_channel_post);
    
    if (!message) {
      logger.warn(`No message or channel_post in update. Update keys: ${Object.keys(update)}`);
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

    logger.info(`Message content: ${JSON.stringify(message, null, 2)}`);
    logger.info(`Message structure: ${JSON.stringify({ 
      messageKeys: Object.keys(message),
      hasPhoto: !!message.photo,
      hasVideo: !!message.video,
      isEdited: isEdited,
      isChannelPost: isChannelPost
    })}`);

    const chat = message.chat;
    const mediaGroupId = message.media_group_id;
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    logger.info(`Media details: ${JSON.stringify({
      hasPhoto: !!photo,
      hasVideo: !!video,
      mediaGroupId,
      mediaObject: media
    })}`);

    if (!media) {
      logger.info(`No media in message, handling as text message`);
      
      // Handle non-media messages
      const nonMediaMessage: Partial<OtherMessageData> = {
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        telegram_message_id: message.message_id,
        message_type: 'text',
        message_text: message.text,
        is_edited: isEdited,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
        telegram_data: update,
        processing_state: 'initialized'
      };

      // If this is an edited message, update the edit history
      if (isEdited) {
        // Get the existing message
        const { data: existingMessage } = await supabase
          .from('other_messages')
          .select('*')
          .eq('chat_id', message.chat.id)
          .eq('telegram_message_id', message.message_id)
          .single();
          
        if (existingMessage) {
          logger.info(`Updating edit history for text message`);
          // Create new edit history entry
          const newEntry: EditHistoryEntry = {
            edit_date: new Date(message.edit_date * 1000).toISOString(),
            previous_caption: existingMessage.message_text || '',
            new_caption: message.text || '',
            is_channel_post: isChannelPost
          };
          
          // Update the edit_history array
          const updatedHistory = existingMessage.edit_history 
            ? [...existingMessage.edit_history, newEntry] 
            : [newEntry];
            
          // Update the message with edit history
          nonMediaMessage.edit_history = updatedHistory;
        }
      }

      logger.info(`Upserting text message`);
      const { error: textError } = await supabase
        .from('other_messages')
        .upsert([nonMediaMessage as OtherMessageData], { onConflict: 'chat_id,telegram_message_id' });

      if (textError) {
        logger.error(`Error upserting text message: ${textError.message}`);
        throw textError;
      }

      return new Response(JSON.stringify({ 
        status: 'success', 
        message: 'Text message processed',
        correlation_id: correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Check if this media has been processed before using file_unique_id
    // We need to check both chat_id and file_unique_id to handle cases where the same media
    // is sent to different chats
    const { data: existingMedia, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .eq('chat_id', chat.id)
      .maybeSingle();

    if (queryError) {
      logger.error(`Error checking existing media: ${queryError.message}`);
    }

    logger.info(`Existing media check: ${JSON.stringify({
      exists: !!existingMedia,
      fileUniqueId: media.file_unique_id,
      chatId: chat.id,
      existingId: existingMedia?.id
    })}`);

    // Extract media info
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      logger.error(`Failed to extract media info from message`);
      throw new Error('Failed to extract media info');
    }
    
    // Generate filename with chat_id to ensure uniqueness across chats
    const fileExt = video ? video.mime_type.split('/')[1] : 'jpeg';
    const storagePath = `${chat.id}_${media.file_unique_id}.${fileExt}`;
    
    // Process media - this will handle checking if it exists, downloading, and uploading
    let storageUrl = existingMedia?.public_url;
    
    if (!existingMedia || !storageUrl) {
      logger.info(`Processing media for storage`);
      try {
        // Use the downloadMedia function which handles everything
        const newStorageUrl = await downloadMedia(
          supabase,
          mediaInfo,
          existingMedia?.id || 'new',
          telegramToken,
          storagePath
        );
        
        if (newStorageUrl) {
          storageUrl = newStorageUrl;
          logger.info(`Media processed successfully, public URL: ${storageUrl}`);
        } else {
          logger.error(`Failed to get storage URL for media`);
          // Create a fallback URL that points to Telegram's CDN directly
          const fileUrl = await getFileUrl(media.file_id, telegramToken);
          storageUrl = fileUrl;
          logger.warn(`Using Telegram CDN URL as fallback: ${storageUrl}`);
        }
      } catch (mediaError) {
        logger.error(`Error processing media: ${mediaError.message}`);
        // Try to get a direct Telegram URL as fallback
        try {
          const fileUrl = await getFileUrl(media.file_id, telegramToken);
          storageUrl = fileUrl;
          logger.warn(`Using Telegram CDN URL as fallback: ${storageUrl}`);
        } catch (fileUrlError) {
          logger.error(`Failed to get Telegram file URL: ${fileUrlError.message}`);
        }
        // Continue with the process even if media processing fails
        logger.warn(`Continuing despite media processing error`);
      }
    } else {
      logger.info(`Using existing storage URL: ${storageUrl}`);
    }

    // Prepare message data
    const messageData: Partial<MessageData> = {
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '', // Store empty string if no caption
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: storageUrl,
      storage_path: storagePath,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update,
      telegram_message_id: message.message_id,
      update_id: update.update_id ? update.update_id.toString() : undefined,
      is_channel_post: isChannelPost
    };

    // Handle edited messages
    if (isEdited) {
      logger.info(`Processing edited message`);
      messageData.is_edited = true;
      messageData.edit_date = new Date(message.edit_date * 1000).toISOString();
      messageData.processing_state = message.caption ? 'pending' : 'initialized';
      
      // If we have an existing message, update the edit history
      if (existingMedia) {
        // Create new edit history entry
        const newEntry: EditHistoryEntry = {
          edit_date: messageData.edit_date!,
          previous_caption: existingMedia.caption || '',
          new_caption: message.caption || '',
          is_channel_post: isChannelPost
        };
        
        // Update the edit_history array
        const updatedHistory = existingMedia.edit_history 
          ? [...existingMedia.edit_history, newEntry] 
          : [newEntry];
          
        // Add edit history to message data
        messageData.edit_history = updatedHistory;
      }
    }

    logger.info(`Prepared message data: ${JSON.stringify(messageData, null, 2)}`);

    // For edits, update existing record
    if (existingMedia) {
      logger.info(`Updating existing media`);
      const { error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id);

      if (updateError) {
        logger.error(`Error updating message: ${updateError.message}`);
        throw updateError;
      }
      
      // If this is an edited message with caption, trigger re-analysis
      if (isEdited && message.caption) {
        logger.info(`Triggering re-analysis for edited caption`);
        await handleEditedCaption(
          existingMedia.id,
          existingMedia.caption || '',
          message.caption,
          correlationId,
          existingMedia.analyzed_content,
          messageData.edit_date!,
          isChannelPost,
          mediaGroupId
        );
      }
    } 
    // For new messages, insert
    else {
      logger.info(`Inserting new media`);
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert([messageData as MessageData])
        .select();

      if (insertError) {
        logger.error(`Error inserting message: ${insertError.message}`);
        throw insertError;
      }
      
      // If part of a media group, check if any other message in the group has analyzed content
      if (mediaGroupId && newMessage && newMessage.length > 0) {
        logger.info(`Message is part of a media group, checking for analyzed content`);
        
        const analyzedMessage = await findAnalyzedMessageInGroup(mediaGroupId, correlationId);
        
        if (analyzedMessage && analyzedMessage.analyzed_content) {
          logger.info(`Found analyzed content in group, syncing to this message`);
          
          // Update the message with the analyzed content
          const { error: syncError } = await supabase
            .from('messages')
            .update({
              analyzed_content: analyzedMessage.analyzed_content,
              message_caption_id: analyzedMessage.id,
              is_original_caption: false,
              group_caption_synced: true,
              processing_state: 'completed',
              processing_completed_at: new Date().toISOString()
            })
            .eq('id', newMessage[0].id);
            
          if (syncError) {
            logger.error(`Error syncing analyzed content: ${syncError.message}`);
            
            // Log the error in the message state
            await supabase
              .from('messages')
              .update({
                processing_state: 'error',
                error_message: `Error syncing analyzed content: ${syncError.message}`,
                retry_count: 0,
                last_error_at: new Date().toISOString()
              })
              .eq('id', newMessage[0].id);
          }
        }
      }
      
      // Only trigger analysis if there's a caption
      if (message.caption && newMessage && newMessage.length > 0) {
        logger.info(`Triggering caption analysis for message: ${newMessage[0].id}`);
        try {
          await supabase.functions.invoke('parse-caption-with-ai', {
            body: { 
              messageId: newMessage[0].id,
              caption: message.caption,
              correlationId: correlationId,
              media_group_id: mediaGroupId
            }
          });
        } catch (analysisError) {
          logger.error(`Error triggering caption analysis: ${analysisError.message}`);
          
          // Record the error and set up for retry
          const { data: existingMessage } = await supabase
            .from('messages')
            .select('retry_count')
            .eq('id', newMessage[0].id)
            .single();
            
          const retryCount = (existingMessage?.retry_count || 0) + 1;
          
          await supabase
            .from('messages')
            .update({
              processing_state: 'error',
              error_message: `Error triggering caption analysis: ${analysisError.message}`,
              retry_count: retryCount,
              last_error_at: new Date().toISOString()
            })
            .eq('id', newMessage[0].id);
            
          // Log the error in the audit log
          await supabase
            .from('analysis_audit_log')
            .insert({
              message_id: newMessage[0].id,
              media_group_id: mediaGroupId,
              event_type: 'ANALYSIS_ERROR',
              error_message: analysisError.message,
              processing_details: {
                error_time: new Date().toISOString(),
                retry_count: retryCount,
                correlation_id: correlationId
              }
            });
            
          logger.warn(`Recorded error for retry, count: ${retryCount}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        message: 'Message processed',
        correlation_id: correlationId,
        mediaGroupId: mediaGroupId || null,
        isEdited: isEdited,
        isChannelPost: isChannelPost,
        storagePath: storagePath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    const logger = getLogger(correlationId);
    logger.error(`Error processing webhook: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message,
        stack: error.stack,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

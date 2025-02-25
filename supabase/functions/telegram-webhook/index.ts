import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
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

// Define types for message data
interface EditHistoryEntry {
  edit_date: string;
  previous_caption: string;
  new_caption: string;
  is_channel_post: boolean;
}

interface MessageData {
  id?: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  media_group_id?: string;
  caption: string;
  file_id: string;
  file_unique_id: string;
  public_url?: string;
  storage_path?: string;
  mime_type: string;
  file_size?: number;
  width: number;
  height: number;
  duration?: number;
  processing_state: string;
  telegram_data: Record<string, unknown>;
  telegram_message_id: number;
  correlation_id?: string;
  update_id?: string;
  is_edited?: boolean;
  edit_date?: string;
  edited_channel_post?: string;
  edit_history?: EditHistoryEntry[];
  analyzed_content?: Record<string, unknown> | null;
  message_caption_id?: number;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  processing_completed_at?: string;
}

// Import utilities
import { downloadAndStoreMedia, getFileUrl, extractMediaInfo } from "./utils/mediaUtils.ts";
import { ensureStorageBucketExists, checkFileExistsInStorage } from "./utils/storageUtils.ts";

async function findAnalyzedMessageInGroup(mediaGroupId: string, correlationId: string): Promise<MessageData | null> {
  console.log(`🔍 [${correlationId}] Looking for analyzed message in group:`, mediaGroupId);
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .not('analyzed_content', 'is', null)
      .limit(1);
    
    if (error) {
      console.error(`❌ [${correlationId}] Error finding analyzed message:`, error);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ [${correlationId}] Found analyzed message in group`);
      return data[0];
    }
    
    console.log(`ℹ️ [${correlationId}] No analyzed message found in group`);
    return null;
  } catch (error) {
    console.error(`❌ [${correlationId}] Error finding analyzed message:`, error);
    return null;
  }
}

async function handleEditedCaption(
  messageId: number,
  previousCaption: string,
  newCaption: string,
  correlationId: string,
  analyzedContent: Record<string, unknown> | null,
  editDate: string,
  isChannelPost: boolean,
  mediaGroupId?: string
): Promise<void> {
  console.log(`🔄 [${correlationId}] Handling edited caption:`, {
    messageId,
    previousCaption,
    newCaption,
    hasAnalyzedContent: !!analyzedContent,
    editDate,
    isChannelPost,
    mediaGroupId
  });
  
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
      
      console.log(`ℹ️ [${correlationId}] Media group caption check:`, {
        mediaGroupId,
        isOriginalCaption
      });
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
    
    console.log(`✅ [${correlationId}] Triggered re-analysis for edited caption:`, {
      success: !!response.data?.success,
      isOriginalCaption,
      mediaGroupId
    });
    
    // If this is not the original caption holder but part of a media group,
    // we need to find the original caption holder and sync from it
    if (mediaGroupId && !isOriginalCaption) {
      console.log(`ℹ️ [${correlationId}] Message is part of media group but not original caption, finding caption source`);
      
      const { data: groupData } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .eq('media_group_id', mediaGroupId)
        .eq('is_original_caption', true)
        .limit(1);
        
      if (groupData && groupData.length > 0 && groupData[0].analyzed_content) {
        console.log(`✅ [${correlationId}] Found original caption source, syncing content`);
        
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
    console.error(`❌ [${correlationId}] Error handling edited caption:`, error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Generate a correlation ID for tracking this request
  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    const rawBody = await req.text();
    console.log(`📝 [${correlationId}] Raw request body:`, rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      console.error(`❌ [${correlationId}] Failed to parse JSON:`, e);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json', correlation_id: correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📥 [${correlationId}] Parsed webhook update:`, JSON.stringify(update, null, 2));
    
    // Log the structure of edited_channel_post if present for debugging
    if (update.edited_channel_post) {
      console.log(`ℹ️ [${correlationId}] Edited channel post structure:`, { 
        keys: Object.keys(update.edited_channel_post),
        hasMessageId: !!update.edited_channel_post.message_id
      });
    }
    
    // Handle both regular messages and channel posts
    const message = update.message || update.channel_post || 
                    (update.edited_channel_post ? update.edited_channel_post : null) || 
                    (update.edited_message ? update.edited_message : null);
    const isEdited = Boolean(update.edited_message || update.edited_channel_post);
    const isChannelPost = Boolean(update.channel_post || update.edited_channel_post);
    
    if (!message) {
      console.log(`❌ [${correlationId}] No message or channel_post in update. Update keys:`, Object.keys(update));
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

    console.log(`📨 [${correlationId}] Message content:`, JSON.stringify(message, null, 2));
    console.log(`ℹ️ [${correlationId}] Message structure:`, { 
      messageKeys: Object.keys(message),
      hasPhoto: !!message.photo,
      hasVideo: !!message.video,
      isEdited: isEdited,
      isChannelPost: isChannelPost
    });

    const chat = message.chat;
    const mediaGroupId = message.media_group_id;
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    console.log(`📸 [${correlationId}] Media details:`, {
      hasPhoto: !!photo,
      hasVideo: !!video,
      mediaGroupId,
      mediaObject: media
    });

    if (!media) {
      console.log(`ℹ️ [${correlationId}] No media in message, handling as text message`);
      
      // Handle non-media messages
      const nonMediaMessage = {
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        telegram_message_id: message.message_id,
        message_type: 'text',
        message_text: message.text,
        is_edited: isEdited,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
        telegram_data: update,
        processing_state: 'initialized',
        correlation_id: correlationId
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
          console.log(`🔄 [${correlationId}] Updating edit history for text message`);
          // Create new edit history entry
          const newEntry = {
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

      console.log(`📝 [${correlationId}] Upserting text message`);
      const { error: textError } = await supabase
        .from('other_messages')
        .upsert([nonMediaMessage], { onConflict: 'chat_id,telegram_message_id' });

      if (textError) {
        console.error(`❌ [${correlationId}] Error upserting text message:`, textError);
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
    const { data: existingMedia, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
      console.error(`❌ [${correlationId}] Error checking existing media:`, queryError);
    }

    console.log(`🔍 [${correlationId}] Existing media check:`, {
      exists: !!existingMedia,
      fileUniqueId: media.file_unique_id,
      existingId: existingMedia?.id
    });

    // Always get the Telegram file URL
    const telegramFileUrl = await getFileUrl(media.file_id, telegramToken);
    console.log(`📥 [${correlationId}] Got Telegram file URL:`, telegramFileUrl);
    
    // Generate filename and check if it exists in storage
    const bucketName = 'telegram-media';
    const storagePath = `${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`;
    const fileExistsInStorage = await checkFileExistsInStorage(supabase, bucketName, storagePath, correlationId);
    
    // Always try to upload the media to storage, regardless of whether it exists in the database
    let storageUrl = existingMedia?.public_url;
    
    if (!fileExistsInStorage) {
      console.log(`📤 [${correlationId}] Media not found in storage, uploading to storage bucket`);
      try {
        // Use downloadAndStoreMedia from mediaUtils
        const mediaResult = await downloadAndStoreMedia(
          message,
          supabase,
          correlationId,
          telegramToken
        );
        
        if (mediaResult) {
          storageUrl = mediaResult.publicUrl;
          console.log(`✅ [${correlationId}] Media uploaded successfully, public URL:`, storageUrl);
        }
      } catch (uploadError) {
        console.error(`❌ [${correlationId}] Error uploading media to storage:`, uploadError);
        // Continue with the process even if upload fails
        console.log(`⚠️ [${correlationId}] Continuing despite upload error`);
      }
    } else {
      console.log(`♻️ [${correlationId}] File exists in storage, using existing URL:`, storageUrl);
    }

    // Prepare message data
    const messageData: MessageData = {
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
      correlation_id: correlationId,
      update_id: update.update_id ? update.update_id.toString() : undefined
    };

    // Handle edited messages
    if (isEdited) {
      console.log(`🔄 [${correlationId}] Processing edited message`);
      messageData.is_edited = true;
      messageData.edit_date = new Date(message.edit_date * 1000).toISOString();
      messageData.processing_state = message.caption ? 'pending' : 'initialized';
      
      // Store edited_channel_post if this is from an edited channel post
      if (update.edited_channel_post) {
        messageData.edited_channel_post = JSON.stringify(update.edited_channel_post);
      }
      
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

    console.log(`📝 [${correlationId}] Prepared message data:`, JSON.stringify(messageData, null, 2));

    // For edits, update existing record
    if (existingMedia) {
      console.log(`🔄 [${correlationId}] Updating existing media`);
      const { error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id);

      if (updateError) {
        console.error(`❌ [${correlationId}] Error updating message:`, updateError);
        throw updateError;
      }
      
      // If this is an edited message with caption, trigger re-analysis
      if (isEdited && message.caption) {
        console.log(`🔄 [${correlationId}] Triggering re-analysis for edited caption`);
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
      console.log(`📥 [${correlationId}] Inserting new media`);
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert([messageData])
        .select();

      if (insertError) {
        console.error(`❌ [${correlationId}] Error inserting message:`, insertError);
        throw insertError;
      }
      
      // If part of a media group, check if any other message in the group has analyzed content
      if (mediaGroupId && newMessage && newMessage.length > 0) {
        console.log(`🔍 [${correlationId}] Message is part of a media group, checking for analyzed content`);
        
        const analyzedMessage = await findAnalyzedMessageInGroup(mediaGroupId, correlationId);
        
        if (analyzedMessage && analyzedMessage.analyzed_content) {
          console.log(`✅ [${correlationId}] Found analyzed content in group, syncing to this message`);
          
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
            console.error(`❌ [${correlationId}] Error syncing analyzed content:`, syncError);
            
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
        console.log(`🔄 [${correlationId}] Triggering caption analysis for message:`, newMessage[0].id);
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
          console.error(`❌ [${correlationId}] Error triggering caption analysis:`, analysisError);
          
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
            
          console.log(`⚠️ [${correlationId}] Recorded error for retry, count: ${retryCount}`);
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
    console.error(`❌ [${correlationId}] Error processing webhook:`, error);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  findExistingMessage, 
  findMessageByFileUniqueId,
  updateMessage,
  handleEditedCaption,
  findAnalyzedMessageInGroup
} from './utils/dbOperations.ts';
import { getLogger } from './utils/logger.ts';
import { MessageData, EditHistoryEntry } from './types.ts';

// Define types for message data
interface NonMediaMessage {
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  telegram_message_id: number;
  message_type: string;
  message_text?: string;
  is_edited: boolean;
  edit_date: string | null;
  telegram_data: Record<string, unknown>;
  processing_state: string;
  correlation_id: string;
  edit_history?: EditHistoryEntry[];
}

interface MediaMessageData {
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  media_group_id?: string;
  caption: string;
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width: number;
  height: number;
  duration?: number;
  processing_state: string;
  telegram_data: Record<string, unknown>;
  telegram_message_id: number;
  correlation_id: string;
  update_id?: string;
  is_edited?: boolean;
  edit_date?: string;
  edited_channel_post?: string;
  edit_history?: EditHistoryEntry[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Generate a correlation ID for tracking this request
  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const logger = getLogger(correlationId);
  
  try {
    // @ts-expect-error - Deno is available in Supabase Edge Functions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update = await req.json();
    logger.info('Received webhook update:', { updateKeys: Object.keys(update) });
    
    // Log the structure of edited_channel_post if present for debugging
    if (update.edited_channel_post) {
      logger.info('Edited channel post structure:', { 
        keys: Object.keys(update.edited_channel_post),
        hasMessageId: !!update.edited_channel_post.message_id
      });
    }
    
    const message = update.message || update.channel_post || 
                    (update.edited_channel_post ? update.edited_channel_post : null) || 
                    (update.edited_message ? update.edited_message : null);
    const isEdited = Boolean(update.edited_message || update.edited_channel_post);
    const isChannelPost = Boolean(update.channel_post || update.edited_channel_post);
    
    if (!message) {
      logger.error('No message found in update:', update);
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

    // Log the message structure to help with debugging
    logger.info('Message structure', { 
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

    if (!media) {
      logger.info('No media in message, handling as text message');
      
      // Handle non-media messages
      const nonMediaMessage: NonMediaMessage = {
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
        const { data: existingMessage } = await supabaseClient
          .from('other_messages')
          .select('*')
          .eq('chat_id', message.chat.id)
          .eq('telegram_message_id', message.message_id)
          .single();
          
        if (existingMessage) {
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

      const { error: textError } = await supabaseClient
        .from('other_messages')
        .upsert([nonMediaMessage], { onConflict: 'chat_id,telegram_message_id' });

      if (textError) throw textError;

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
    let existingMedia: MessageData | null = null;
    try {
      const { data } = await supabaseClient
        .from("messages")
        .select("*")
        .eq("file_unique_id", media.file_unique_id)
        .maybeSingle();
        
      existingMedia = data;
      
      logger.info('Existing media check', {
        exists: !!existingMedia,
        fileUniqueId: media.file_unique_id,
        existingId: existingMedia?.id,
        isEdited: isEdited
      });
    } catch (error) {
      logger.error('Error checking existing media', {
        error: error.message,
        fileUniqueId: media.file_unique_id
      });
    }

    // Prepare message data
    const messageData: MediaMessageData = {
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '', // Store empty string if no caption
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
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

    // For edits, update existing record
    if (existingMedia) {
      logger.info('Updating existing media');
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id);

      if (updateError) throw updateError;
      
      // If this is an edited message with caption, trigger re-analysis
      if (isEdited && message.caption) {
        // Call handleEditedCaption with the updated parameters
        await handleEditedCaption(
          supabaseClient,
          existingMedia.id,
          existingMedia.caption || '',
          message.caption,
          correlationId,
          // @ts-expect-error - analyzed_content can be null during re-analysis
          existingMedia.analyzed_content,
          messageData.edit_date!,
          isChannelPost,
          mediaGroupId
        );
      }
    } 
    // For new messages, insert
    else {
      logger.info('Inserting new media');
      const { data, error: insertError } = await supabaseClient
        .from('messages')
        .insert([messageData])
        .select();

      if (insertError) throw insertError;
      
      // If part of a media group, check if any other message in the group has analyzed content
      if (mediaGroupId && data && data.length > 0) {
        logger.info('Message is part of a media group, checking for analyzed content');
        
        const analyzedMessage = await findAnalyzedMessageInGroup(supabaseClient, mediaGroupId);
        
        if (analyzedMessage && analyzedMessage.analyzed_content) {
          logger.info('Found analyzed content in group, syncing to this message');
          
          // Update the message with the analyzed content
          await updateMessage(
            supabaseClient,
            data[0].id,
            {
              analyzed_content: analyzedMessage.analyzed_content,
              message_caption_id: analyzedMessage.id,
              is_original_caption: false,
              group_caption_synced: true,
              processing_state: 'completed',
              processing_completed_at: new Date().toISOString()
            }
          );
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
        isChannelPost: isChannelPost
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

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
    );
  }
});

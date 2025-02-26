
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  media_group_id?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    mime_type: string;
  };
  caption?: string;
  date: number;
  forward_from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  forward_from_chat?: {
    id: number;
    title: string;
    username?: string;
  };
  forward_date?: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook received:', new Date().toISOString());
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log('Processing update with correlation ID:', correlationId);
    
    // Extract message data
    const messageData = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!messageData) {
      throw new Error('No valid message data found in update');
    }

    console.log('Message data extracted:', {
      message_id: messageData.message_id,
      chat_id: messageData.chat.id,
      media_group_id: messageData.media_group_id,
      has_photo: !!messageData.photo,
      has_video: !!messageData.video,
      has_caption: !!messageData.caption
    });

    // Handle media messages
    if (messageData.photo || messageData.video) {
      const media = messageData.photo ? messageData.photo[messageData.photo.length - 1] : messageData.video;
      const storage_path = `${media.file_unique_id}.${messageData.video ? messageData.video.mime_type.split('/')[1] : 'jpeg'}`;

      console.log('Processing media message:', {
        file_unique_id: media.file_unique_id,
        media_type: messageData.video ? 'video' : 'photo',
        storage_path
      });

      // Prepare message data with correct forward fields
      const messageInsert = {
        telegram_message_id: messageData.message_id,
        chat_id: messageData.chat.id,
        chat_type: messageData.chat.type,
        chat_title: messageData.chat.title,
        media_group_id: messageData.media_group_id,
        caption: messageData.caption,
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        width: media.width,
        height: media.height,
        duration: messageData.video?.duration,
        mime_type: messageData.video ? messageData.video.mime_type : 'image/jpeg',
        storage_path,
        processing_state: messageData.caption ? 'pending' : 'initialized',
        correlation_id: correlationId,
        telegram_data: messageData,
        message_url: `https://t.me/c/${messageData.chat.id.toString().slice(4)}/${messageData.message_id}`,
        deleted_from_telegram: false,
        is_forwarded: messageData.forward_date ? 'yes' : 'no',
        is_forwarded_from: messageData.forward_from?.username || 
                         messageData.forward_from_chat?.username || 
                         null
      };

      try {
        console.log('Attempting to insert message...');
        
        // First try to insert as new message
        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert([messageInsert]);

        // If insert fails with unique constraint violation
        if (insertError?.code === '23505') {
          console.log('Duplicate message detected, handling update flow...');
          
          // Get the existing message
          const { data: existingMessage, error: fetchError } = await supabaseClient
            .from('messages')
            .select('id, caption, analyzed_content, processing_state, correlation_id')
            .eq('file_unique_id', media.file_unique_id)
            .eq('chat_id', messageData.chat.id)
            .eq('deleted_from_telegram', false)
            .single();

          if (fetchError) {
            console.error('Error fetching existing message:', fetchError);
            throw fetchError;
          }

          if (existingMessage) {
            console.log('Found existing message:', {
              id: existingMessage.id,
              current_state: existingMessage.processing_state,
              has_analyzed_content: !!existingMessage.analyzed_content
            });

            // If caption changed or this is a forward/media group, trigger reanalysis
            if (existingMessage.caption !== messageData.caption || 
                messageData.media_group_id || 
                messageData.forward_date) {
              
              console.log('Changes detected, updating message and triggering reanalysis');

              // Store current analyzed_content in old_analyzed_content
              const updateData = {
                ...messageInsert,
                updated_at: new Date().toISOString(),
                processing_state: 'pending',
                old_analyzed_content: existingMessage.analyzed_content 
                  ? [existingMessage.analyzed_content]
                  : []
              };

              const { error: updateError } = await supabaseClient
                .from('messages')
                .update(updateData)
                .eq('id', existingMessage.id);

              if (updateError) {
                console.error('Error updating existing message:', updateError);
                throw updateError;
              }

              // Log the update operation
              await supabaseClient.rpc('xdelo_log_event', {
                p_event_type: 'message_updated',
                p_entity_id: existingMessage.id,
                p_telegram_message_id: messageData.message_id,
                p_chat_id: messageData.chat.id,
                p_previous_state: { caption: existingMessage.caption },
                p_new_state: { caption: messageData.caption },
                p_metadata: {
                  update_reason: messageData.forward_date ? 'forward' : 
                               messageData.media_group_id ? 'media_group' : 'caption_change',
                  correlation_id: correlationId
                }
              });

              // Trigger AI analysis if caption changed
              if (existingMessage.caption !== messageData.caption) {
                console.log('Caption changed, triggering AI analysis');
                await supabaseClient.functions.invoke('parse-caption-with-ai', {
                  body: {
                    messageId: existingMessage.id,
                    caption: messageData.caption
                  }
                });
              }
            }
          }
        } else if (insertError) {
          console.error('Error inserting message:', insertError);
          throw insertError;
        }

        // Log webhook event with detailed metadata
        await supabaseClient.rpc('xdelo_log_webhook_event', {
          p_event_type: 'message_received',
          p_chat_id: messageData.chat.id,
          p_message_id: messageData.message_id,
          p_media_type: messageData.video ? 'video' : 'photo',
          p_raw_data: messageData,
          p_error_message: null
        });

      } catch (error) {
        console.error('Error processing media message:', error);
        
        // Log the error in webhook events
        await supabaseClient.rpc('xdelo_log_webhook_event', {
          p_event_type: 'message_error',
          p_chat_id: messageData.chat.id,
          p_message_id: messageData.message_id,
          p_media_type: messageData.video ? 'video' : 'photo',
          p_raw_data: messageData,
          p_error_message: error.message
        });

        throw error;
      }
    } else {
      // Handle non-media messages with logging
      console.log('Processing non-media message');
      
      const { error: otherMessageError } = await supabaseClient
        .from('other_messages')
        .insert([{
          telegram_message_id: messageData.message_id,
          chat_id: messageData.chat.id,
          chat_type: messageData.chat.type,
          message_type: update.edited_message ? 'edited_message' : 
                       update.channel_post ? 'channel_post' : 
                       update.edited_channel_post ? 'edited_channel_post' : 
                       'message',
          telegram_data: messageData,
          correlation_id: correlationId
        }]);

      if (otherMessageError) {
        console.error('Error storing non-media message:', otherMessageError);
        throw otherMessageError;
      }
    }

    console.log('Webhook processing completed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});

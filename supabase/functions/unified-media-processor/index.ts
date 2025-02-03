import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { MediaMessage, ProcessingState } from "./types.ts";
import { downloadTelegramFile, getMediaItem, hasValidCaption } from "./mediaUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting unified media processing');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update = await req.json();
    const message: MediaMessage = update.message || update.channel_post;

    if (!message) {
      console.log('No media message found in update');
      return new Response(
        JSON.stringify({ message: 'No content to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const correlationId = crypto.randomUUID();
    console.log(`Processing message ${message.message_id} with correlation ID ${correlationId}`);

    const mediaItem = getMediaItem(message);
    if (!mediaItem) {
      console.log('No media found in message');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No media content found',
          correlation_id: correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const validCaption = hasValidCaption(message);
    console.log(`Message caption status: ${validCaption ? 'Valid' : 'Missing or empty'}`);

    // Check for existing analyzed content in the media group
    let existingAnalysis = null;
    if (message.media_group_id && validCaption) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .eq('is_original_caption', true)
        .not('analyzed_content', 'is', null)
        .maybeSingle();

      if (existingMessage?.analyzed_content) {
        console.log('Found existing analyzed content in media group');
        existingAnalysis = existingMessage.analyzed_content;
      }
    }

    // Download and process media
    const fileResponse = await downloadTelegramFile(
      mediaItem.file_id, 
      Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
    );
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download media: ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    console.log('Media downloaded successfully');

    // Upload to storage
    const fileName = `${mediaItem.file_unique_id}.${mediaItem.mime_type?.split("/")[1] || 'jpg'}`;
    const { error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(fileName, fileBuffer, {
        contentType: mediaItem.mime_type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = await supabase.storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    console.log('Media uploaded successfully');

    // Determine initial state based on message type and existing analysis
    let initialState: ProcessingState;
    if (message.media_group_id) {
      if (existingAnalysis) {
        initialState = 'ready_for_sync';
      } else if (validCaption) {
        initialState = 'has_caption';
      } else {
        initialState = 'waiting_caption';
      }
    } else {
      initialState = validCaption ? 'has_caption' : 'initialized';
    }

    // Prepare message data
    const messageData = {
      telegram_message_id: message.message_id,
      media_group_id: message.media_group_id,
      caption: message.caption || '',
      file_id: mediaItem.file_id,
      file_unique_id: mediaItem.file_unique_id,
      public_url: publicUrl,
      mime_type: mediaItem.mime_type,
      file_size: mediaItem.file_size,
      width: mediaItem.width,
      height: mediaItem.height,
      duration: mediaItem.duration,
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_data: { message },
      processing_state: initialState,
      is_original_caption: message.media_group_id && validCaption ? true : false,
      analyzed_content: existingAnalysis
    };

    // Create or update message record
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, processing_state')
      .eq('file_unique_id', mediaItem.file_unique_id)
      .maybeSingle();
    
    let currentMessageId;
    
    if (existingMessage) {
      const { error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      currentMessageId = existingMessage.id;
    } else {
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      currentMessageId = newMessage.id;
    }

    // Process caption based on message type
    if (validCaption && !existingAnalysis) {
      console.log(`Processing caption for ${message.media_group_id ? 'media group' : 'single message'}`);
      
      // Update state to processing_caption
      await supabase
        .from('messages')
        .update({ processing_state: 'processing_caption' })
        .eq('id', currentMessageId);

      // Trigger AI analysis
      const aiResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_id: currentMessageId,
            media_group_id: message.media_group_id,
            caption: message.caption
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`Caption analysis failed: ${errorText}`);
      }
    }

    console.log('Processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Media processed successfully',
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in unified media processor:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
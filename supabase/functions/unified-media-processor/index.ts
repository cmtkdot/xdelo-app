import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaMessage {
  message_id: number;
  media_group_id?: string;
  caption?: string;
  photo?: any[];
  video?: any;
  document?: any;
  chat: {
    id: number;
    type: string;
  };
}

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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const correlationId = crypto.randomUUID();
    console.log(`Processing message ${message.message_id} with correlation ID ${correlationId}`);

    // Step 1: Create initial message record
    const mediaItem = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;

    if (!mediaItem) {
      console.log('No media found in message');
      return new Response(
        JSON.stringify({ message: 'No media content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Download and process media
    const fileResponse = await downloadTelegramFile(
      mediaItem.file_id, 
      Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
    );
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download media: ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    console.log('Media downloaded successfully');

    // Step 3: Upload to storage
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

    // Step 4: Create or update message record
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
      processing_state: message.caption ? 'caption_ready' : 'initialized',
      is_original_caption: message.media_group_id && message.caption ? true : false
    };

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

    console.log('Message record created/updated successfully');

    // Step 5: If there's a caption, analyze it
    if (message.caption) {
      console.log('Processing caption');
      
      // Wait a bit to ensure media is properly processed
      await new Promise(resolve => setTimeout(resolve, 2000));

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
        console.error('Caption analysis failed:', errorText);
        throw new Error(`Caption analysis failed: ${errorText}`);
      }

      const { analyzed_content } = await aiResponse.json();

      // Step 6: If it's part of a media group, sync the analysis
      if (message.media_group_id) {
        console.log('Syncing media group analysis');
        
        // Wait a bit more for any remaining media uploads
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
          p_message_id: currentMessageId,
          p_media_group_id: message.media_group_id,
          p_analyzed_content: analyzed_content,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlationId
        });

        if (syncError) throw syncError;
      } else {
        // For single messages, just update the analysis
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', currentMessageId);

        if (updateError) throw updateError;
      }
    }

    console.log('Processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Media processed successfully',
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in unified media processor:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function downloadTelegramFile(fileId: string, botToken: string): Promise<Response> {
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfo.ok) {
    console.error("Failed to get file info:", fileInfo);
    throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  return fetch(fileUrl);
}
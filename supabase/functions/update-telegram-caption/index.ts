import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, newCaption } = await req.json();
    console.log('Updating caption for message:', messageId, 'New caption:', newCaption);

    // Get environment variables
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TELEGRAM_BOT_TOKEN || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get message details from database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      throw new Error('Message not found');
    }

    // Check if the caption is actually different
    const currentCaption = message.caption || '';
    if (currentCaption === newCaption) {
      console.log('Caption unchanged, skipping update');
      return new Response(
        JSON.stringify({ success: true, message: 'Caption unchanged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update caption in Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: message.chat_id,
          message_id: message.telegram_message_id,
          caption: newCaption,
        }),
      }
    );

    const telegramResult = await telegramResponse.json();
    console.log('Telegram API response:', telegramResult);

    if (!telegramResponse.ok) {
      // Check if it's just a "message not modified" error
      if (telegramResult.description?.includes('message is not modified')) {
        console.log('Message not modified, proceeding with database update');
      } else {
        throw new Error(`Telegram API error: ${JSON.stringify(telegramResult)}`);
      }
    }

    // Update telegram_data with new caption
    const updatedTelegramData = {
      ...message.telegram_data,
      message: {
        ...(message.telegram_data?.message || {}),
        caption: newCaption
      }
    };

    // Update caption in database
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        caption: newCaption,
        telegram_data: updatedTelegramData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // Trigger reanalysis with new caption
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        media_group_id: message.media_group_id,
        caption: newCaption,
        correlation_id: crypto.randomUUID()
      }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
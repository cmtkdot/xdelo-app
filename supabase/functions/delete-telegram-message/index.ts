
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getSupabaseClient, handleError } from "../_shared/supabase.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const { message_id, chat_id, media_group_id } = await req.json();
    console.log("Deleting message:", { message_id, chat_id, media_group_id });

    const supabase = getSupabaseClient();

    // Delete message from Telegram
    const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        message_id: message_id,
      }),
    });

    const result = await response.json();
    console.log("Telegram deletion result:", result);

    if (!result.ok) {
      // Log the error but don't throw - the message might already be deleted
      console.error(`Telegram deletion error: ${result.description}`);
    }

    // Insert a log entry
    await supabase.from('webhook_logs').insert({
      event_type: 'message_deletion',
      chat_id: chat_id,
      message_id: message_id,
      media_group_id: media_group_id,
      metadata: {
        telegram_response: result,
        deletion_time: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleError(error);
  }
});

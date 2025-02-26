import { createClient } from "@supabase/supabase-js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { updateMessageProcessingState } from "../telegram-webhook/dbOperations.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, is_edit, is_forward } = await req.json();

    if (!messageId || !caption) {
      throw new Error('Missing required parameters');
    }

    // First update state to processing
    await updateMessageProcessingState(supabase, messageId, 'processing');

    // Your AI analysis logic here
    const analyzedContent = {
      caption,
      media_group_id,
      is_edit,
      is_forward,
      analyzed_at: new Date().toISOString()
    };

    // Update the message with analyzed content
    await updateMessageProcessingState(
      supabase,
      messageId,
      'completed',
      analyzedContent
    );

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);

    if (error.messageId) {
      await updateMessageProcessingState(
        supabase,
        error.messageId,
        'error',
        null,
        error.message
      );
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

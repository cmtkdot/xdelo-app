
import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";
import { handleMessage } from "./messageHandlers.ts";
import { TelegramWebhookPayload } from "./types.ts";
import { getLogger } from "./logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: TelegramWebhookPayload = await req.json();
    const correlationId = crypto.randomUUID();
    const logger = getLogger(correlationId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const context = {
      supabaseClient: supabase,
      logger,
      correlationId
    };

    const result = await handleMessage(payload, context);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

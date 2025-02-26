
import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";
import { handleMessage } from "./messageHandlers.ts";
import { TelegramWebhookPayload } from "./types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: TelegramWebhookPayload = await req.json();
    const correlationId = crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const logger = {
      info: (message: string, data?: any) => {
        console.log(JSON.stringify({ level: 'info', message, data, correlationId }));
      },
      error: (message: string, error?: any) => {
        console.error(JSON.stringify({ level: 'error', message, error, correlationId }));
      }
    };

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

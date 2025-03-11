
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { xdelo_logMessageError } from '../_shared/messageLogger.ts';
import { handleTelegramUpdate } from './handlers/updateHandler.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate correlation ID for this request
    const correlationId = crypto.randomUUID();
    console.log(`Processing update with correlation ID: ${correlationId}`);
    console.log(`Webhook received: ${new Date().toISOString()}`);

    const update = await req.json();
    return await handleTelegramUpdate(update, correlationId);

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Log the error using the shared error logging
    try {
      await xdelo_logMessageError(
        "webhook", // Use a placeholder ID for general webhook errors
        error.message,
        crypto.randomUUID(),
        'message_create'
      );
    } catch (logError) {
      console.error('Error logging webhook failure:', logError);
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

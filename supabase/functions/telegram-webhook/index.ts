
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

    // Parse the update JSON
    let update;
    try {
      update = await req.json();
    } catch (parseError) {
      console.error('Error parsing webhook JSON:', parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Log basic info about the update
    if (update.message || update.channel_post) {
      const messageObj = update.message || update.channel_post;
      console.log(`Processing ${update.message ? 'message' : 'channel post'} from chat ID: ${messageObj.chat.id}`);
      
      // Log media type if present
      if (messageObj.photo) {
        console.log('Media type: photo');
      } else if (messageObj.video) {
        console.log('Media type: video');
      } else if (messageObj.document) {
        console.log('Media type: document');
      } else if (messageObj.audio) {
        console.log('Media type: audio');
      } else if (messageObj.voice) {
        console.log('Media type: voice');
      } else if (messageObj.sticker) {
        console.log('Media type: sticker');
      }
    }

    // Process the update
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

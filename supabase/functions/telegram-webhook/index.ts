import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleMessage } from "./messageHandlers.ts";
import { getLogger } from "./logger.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID();
  const logger = getLogger(correlationId);

  try {
    const update = await req.json();
    
    const message = update.message || 
                   update.channel_post || 
                   update.edited_message || 
                   update.edited_channel_post;

    if (!message) {
      logger.warn('No message found in update:', { 
        updateKeys: Object.keys(update).filter(k => k !== 'update_id'),
        correlation_id: correlationId
      });
      return new Response(
        JSON.stringify({ success: false, message: 'No message to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageWithMetadata = {
      ...message,
      telegram_data: {
        ...message.telegram_data,
        update_id: update.update_id,
        is_edited: !!(update.edited_message || update.edited_channel_post),
        is_channel: !!(update.channel_post || update.edited_channel_post)
      }
    };

    logger.info('Processing message:', { 
      messageId: message.message_id,
      fileUniqueId: message.photo?.[0]?.file_unique_id || message.document?.file_unique_id,
      updateId: update.update_id,
      isEdited: messageWithMetadata.telegram_data.is_edited,
      isChannel: messageWithMetadata.telegram_data.is_channel,
      correlation_id: correlationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    return await handleMessage(messageWithMetadata, supabase, correlationId);
  } catch (error) {
    logger.error('Webhook error:', { error });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})

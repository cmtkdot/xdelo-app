import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleMessage, handleEditedMessage } from './messageHandlers.ts'
import { getLogger } from './logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID()
  const logger = getLogger(correlationId)

  try {
    const update = await req.json()
    
    // Get any type of message
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

    logger.info('Processing message:', { 
      messageId: message.message_id,
      fileUniqueId: message.photo?.[0]?.file_unique_id || message.document?.file_unique_id,
      correlation_id: correlationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Single handler - file_unique_id will handle duplicates
    return await handleMessage(message, supabase, correlationId);
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

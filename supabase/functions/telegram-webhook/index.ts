import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  handleWebhookUpdate, 
  extractMediaInfo,
  handleMediaMessage,
  handleOtherMessage,
  handleEditedMessage,
  downloadMedia
} from "./messageHandlers.ts"
import "./dbOperations.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

/*************  ✨ Codeium Command ⭐  *************/
/**
 * Logs an event to the unified audit system.
 *
 * @param eventType The type of the event to log
 * @param entityId The ID of the entity the event is related to
 * @param telegramMessageId The ID of the Telegram message the event is related to, or null if not applicable
 * @param chatId The ID of the Telegram chat the event is related to, or null if not applicable
 * @param previousState The state of the entity before the event, or null if not applicable
 * @param newState The state of the entity after the event, or null if not applicable
 * @param metadata Additional metadata to log with the event, or null if not applicable
 * @param correlationId A correlation ID to associate with the event, or null if not applicable
 * @param errorMessage An error message to log with the event, or null if not applicable
 */
/******  38899cd2-ffe1-49cf-be81-af5cb7658546  *******/
async function logAuditEvent(
  eventType: string,
  entityId: string,
  telegramMessageId: number | null,
  chatId: number | null,
  previousState: any = null,
  newState: any = null,
  metadata: any = null,
  correlationId: string | null = null,
  errorMessage: string | null = null
) {
  try {
    await supabase.rpc('xdelo_log_event', {
      p_event_type: eventType,
      p_entity_id: entityId,
      p_telegram_message_id: telegramMessageId,
      p_chat_id: chatId,
      p_previous_state: previousState,
      p_new_state: newState,
      p_metadata: metadata,
      p_correlation_id: correlationId,
      p_error_message: errorMessage
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = metadata?.correlationId || `log_${crypto.randomUUID()}`;
  const logger = getLogger(correlationId);
  
  try {
    const rawBody = await req.text();
    logger.info('Raw request body:', rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger.error('Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await handleWebhookUpdate(supabase, update, correlationId);
    
    return new Response(
      JSON.stringify(response),
      { 
        status: response.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Error processing webhook:', error);

    await logAuditEvent(
      'webhook_error',
      'system',
      null,
      null,
      null,
      null,
      { error: error.message, stack: error.stack },
      correlationId,
      error.message
    );

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

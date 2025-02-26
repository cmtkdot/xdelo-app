import { serve } from "http/server"
import { createClient } from "supabase"
import { getLogger } from "./logger.ts"
import { 
  handleWebhookUpdate, 
  extractMediaInfo,
  handleMediaMessage,
  handleOtherMessage,
  handleEditedMessage
} from "./messageHandlers.ts"
import { downloadMedia } from "./mediaUtils.ts"

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

  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
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

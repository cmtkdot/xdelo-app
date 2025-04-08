import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create Supabase client with service role
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Response formatters
export function formatSuccessResponse(data: Record<string, unknown>, correlationId?: string) {
  return new Response(
    JSON.stringify({ success: true, data, correlationId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

export function formatErrorResponse(error: string, correlationId?: string) {
  return new Response(
    JSON.stringify({ success: false, error, correlationId }),
    { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Message existence check
export async function checkMessageExists(
  chatIdOrMessageId: number | string,
  telegramMessageId?: number
): Promise<boolean> {
  try {
    if (typeof chatIdOrMessageId === 'string' && telegramMessageId === undefined) {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('id', chatIdOrMessageId)
        .maybeSingle();
      
      return !error && !!data;
    }
    
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_id', chatIdOrMessageId)
      .eq('telegram_message_id', telegramMessageId)
      .maybeSingle();
    
    return !error && !!data;
  } catch (error) {
    console.error('Error checking message existence:', error);
    return false;
  }
}

// Audit logging
export async function logEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      error_message: errorMessage,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

// Message state management
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  correlationId: string | null = null,
  analyzedContent: Record<string, unknown> | null = null,
  errorMessage: string | null = null,
): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase
      .rpc('xdelo_update_message_state', {
        p_message_id: messageId,
        p_state: state,
        p_correlation_id: correlationId,
        p_analyzed_content: analyzedContent,
        p_error_message: errorMessage,
      });

    if (error) {
      console.error('Error updating message state:', error);
      return {
        success: false,
        error: error.message,
        messageId,
      };
    }

    return data || {
      success: true,
      messageId,
      state,
    };
  } catch (error) {
    console.error('Exception updating message state:', error.message);
    return {
      success: false,
      error: error.message,
      messageId,
    };
  }
} 
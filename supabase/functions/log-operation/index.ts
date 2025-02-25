import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { operation, messageId, source, action, userId, metadata } = await req.json();
    
    // Generate a correlation ID if not provided
    const correlationId = metadata?.correlationId || `log_${crypto.randomUUID()}`;
    
    // Map the operation to an event type for the unified_audit_logs table
    let eventType;
    switch (operation) {
      case 'deletion':
        eventType = 'message_deleted';
        break;
      case 'create':
        eventType = 'message_created';
        break;
      case 'update':
        eventType = 'message_updated';
        break;
      case 'analyze':
        eventType = 'message_analyzed';
        break;
      case 'sync':
        eventType = 'media_group_synced';
        break;
      case 'user_action':
        eventType = 'user_action';
        break;
      default:
        eventType = 'webhook_received'; // Default fallback
    }
    
    // Insert the log entry into the unified_audit_logs table
    const { data, error } = await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: messageId || userId, // Use messageId or userId as the entity ID
        metadata: {
          ...metadata,
          source,
          action,
          operation,
          logged_from: 'frontend'
        },
        correlation_id: correlationId,
        user_id: userId
      });
    
    if (error) {
      console.error('Error logging operation:', error);
      throw error;
    }
    
    return new Response(
      JSON.stringify({ success: true, correlation_id: correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    const { source, data, type, correlationId } = await req.json();
    
    // Generate a correlation ID if not provided
    const finalCorrelationId = correlationId || `webhook_${crypto.randomUUID()}`;
    
    // Log the incoming webhook
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'webhook_received',
        metadata: {
          source,
          data,
          type,
          http_method: req.method,
          headers: Object.fromEntries([...req.headers])
        },
        correlation_id: finalCorrelationId,
        event_timestamp: new Date().toISOString()
      });
    
    // Based on type, we can route to different handlers
    let result;
    
    switch (type) {
      case 'notification':
        // Process notification type webhook
        // TODO: Implement specific handlers as needed
        break;
        
      case 'integration':
        // Process integration type webhook
        // TODO: Implement specific handlers as needed
        break;
        
      default:
        // Generic handling for unknown types
        result = {
          received: true,
          processed: false,
          message: `Received webhook of type: ${type || 'unknown'}`
        };
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook received",
        correlation_id: finalCorrelationId,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

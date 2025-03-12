
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate a correlation ID for this request
    const correlationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Parse the webhook payload
    const payload = await req.json();
    
    // Log the webhook request
    console.log(JSON.stringify({
      level: 'info',
      timestamp,
      correlation_id: correlationId,
      message: 'Generic webhook received',
      payload_size: JSON.stringify(payload).length
    }));

    // Store the webhook payload in the database
    const { data, error } = await supabase
      .from('webhook_logs')
      .insert({
        webhook_type: 'generic',
        payload: payload,
        correlation_id: correlationId,
        created_at: timestamp
      });

    if (error) {
      throw error;
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        correlation_id: correlationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

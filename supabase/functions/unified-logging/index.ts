
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

    const { 
      eventType, 
      entityId, 
      metadata = {}, 
      previousState, 
      newState, 
      errorMessage,
      userId
    } = await req.json();
    
    // Generate a correlation ID if not provided
    const correlationId = metadata?.correlationId || `log_${crypto.randomUUID()}`;
    
    // Add timestamp to metadata if not provided
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      logged_from: 'edge_function'
    };
    
    // Insert the log entry into the unified_audit_logs table
    const { data, error } = await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: enhancedMetadata,
        previous_state: previousState,
        new_state: newState,
        error_message: errorMessage,
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

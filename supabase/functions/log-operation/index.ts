import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Set up CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogRequest {
  event_type: string;
  entity_id?: string;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlation_id?: string;
}

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

    // Parse request
    const {
      event_type,
      entity_id,
      previous_state,
      new_state,
      metadata,
      correlation_id
    } = await req.json() as LogRequest;

    // Validate required fields
    if (!event_type) {
      throw new Error('Missing required field: event_type');
    }

    // Create log entry
    const { data, error } = await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type,
        entity_id: entity_id || null,
        previous_state: previous_state || null,
        new_state: new_state || null,
        metadata: {
          ...(metadata || {}),
          timestamp: new Date().toISOString(),
          correlation_id: correlation_id || crypto.randomUUID()
        }
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: data.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in log-operation:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
}); 
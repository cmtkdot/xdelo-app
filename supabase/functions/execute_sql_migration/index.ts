
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, params = [], description = "SQL migration" } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SQL query is required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log(`Executing SQL migration: ${description}`);
    console.log(`Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
    
    // Execute the SQL query directly
    const { data, error } = await supabaseClient.rpc('execute_sql_query', {
      p_query: query,
      p_params: params
    });
    
    if (error) {
      throw new Error(`SQL execution error: ${error.message}`);
    }
    
    // Log the migration
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'sql_migration_executed',
      entity_id: crypto.randomUUID(),
      metadata: {
        description,
        execution_time: new Date().toISOString()
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        description,
        result: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error executing SQL migration: ${error.message}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});


import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { withErrorHandling, SecurityLevel } from '../_shared/errorHandler.ts';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function handleSqlExecution(req: Request, correlationId: string) {
  try {
    const { query, params } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SQL query is required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Executing SQL query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
    
    // Execute the SQL query directly using the Supabase client
    const { data, error } = await supabaseClient.rpc('execute_sql_query', {
      p_query: query,
      p_params: params || []
    });
    
    if (error) {
      console.error(`SQL execution error: ${error.message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          details: error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(withErrorHandling(
  'execute_sql', 
  handleSqlExecution, 
  { 
    securityLevel: SecurityLevel.PUBLIC,
    bypassForServiceRole: true
  }
));

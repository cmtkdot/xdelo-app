
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { query, params } = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    const startTime = performance.now();
    
    // Execute SQL query with parameterized query
    const { data, error } = await supabaseAdmin.rpc('xdelo_execute_sql', {
      sql_query: query,
      param_values: params || []
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
    
    // Calculate row count
    const rowCount = Array.isArray(data) ? data.length : 0;
    
    return new Response(
      JSON.stringify({
        data,
        metadata: {
          execution_time_ms: executionTime.toFixed(2),
          row_count: rowCount,
          query_hash: createHash(query)
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error executing SQL:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function createHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(36);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

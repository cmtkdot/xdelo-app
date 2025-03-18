
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // This function helps migrate DB functions from xdelo_ prefix to standard naming
    const { mode = 'analyze' } = await req.json();
    
    // First, get the list of all functions with 'xdelo_' prefix
    const { data: functions, error: functionsError } = await supabase.rpc(
      'execute_sql_query',
      {
        p_query: `
          SELECT 
            routine_name, 
            routine_type,
            routine_definition
          FROM information_schema.routines 
          WHERE 
            routine_schema = 'public' 
            AND routine_name LIKE 'xdelo\\_%'
            AND routine_type = 'FUNCTION'
          ORDER BY routine_name;
        `,
        p_params: []
      }
    );
    
    if (functionsError) {
      throw new Error(`Error getting functions: ${functionsError.message}`);
    }
    
    // Analyze function usages
    const results = {
      total_functions: functions.length,
      analyzed: [] as any[],
      migrated: [] as any[],
      errors: [] as any[]
    };
    
    // For each function, check if it's in use
    for (const fn of functions) {
      try {
        // Check if function is referenced in other functions
        const { data: usageData, error: usageError } = await supabase.rpc(
          'execute_sql_query',
          {
            p_query: `
              SELECT 
                routine_name,
                routine_definition
              FROM information_schema.routines 
              WHERE 
                routine_schema = 'public'
                AND routine_definition LIKE '%${fn.routine_name}%'
                AND routine_name != '${fn.routine_name}';
            `,
            p_params: []
          }
        );
        
        if (usageError) {
          throw new Error(`Error checking function usage: ${usageError.message}`);
        }
        
        // Check if function is referenced by triggers
        const { data: triggerData, error: triggerError } = await supabase.rpc(
          'execute_sql_query',
          {
            p_query: `
              SELECT 
                trigger_name,
                event_manipulation,
                action_statement
              FROM information_schema.triggers
              WHERE 
                action_statement LIKE '%${fn.routine_name}%';
            `,
            p_params: []
          }
        );
        
        if (triggerError) {
          throw new Error(`Error checking trigger usage: ${triggerError.message}`);
        }
        
        // Add function analysis to results
        results.analyzed.push({
          function_name: fn.routine_name,
          referenced_by_functions: usageData,
          referenced_by_triggers: triggerData,
          is_in_use: usageData.length > 0 || triggerData.length > 0,
        });
        
        // If this is in execute mode and function isn't used, we could migrate it
        if (mode === 'execute' && usageData.length === 0 && triggerData.length === 0) {
          // We'd migrate the function here (create a new non-prefixed version and drop the old one)
          // For now, just track what would be migrated
          results.migrated.push({
            function_name: fn.routine_name,
            new_name: fn.routine_name.replace('xdelo_', '')
          });
        }
      } catch (err) {
        results.errors.push({
          function_name: fn.routine_name,
          error: err.message
        });
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'system_maintenance',
      entity_id: crypto.randomUUID(),
      metadata: {
        operation: 'analyze_db_functions',
        mode,
        results
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

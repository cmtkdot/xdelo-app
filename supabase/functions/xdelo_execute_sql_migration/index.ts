
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Create the function to clear all messages and related data
    const sql = `
      CREATE OR REPLACE FUNCTION xdelo_clear_all_messages()
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        deleted_messages INT;
        deleted_other_messages INT;
        deleted_logs INT;
        result_json json;
      BEGIN
        -- Delete all media messages
        WITH deleted AS (
          DELETE FROM messages
          RETURNING id
        )
        SELECT COUNT(*) INTO deleted_messages FROM deleted;
        
        -- Delete all other messages
        WITH deleted AS (
          DELETE FROM other_messages
          RETURNING id
        )
        SELECT COUNT(*) INTO deleted_other_messages FROM deleted;
        
        -- Record the operation in audit logs
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          metadata,
          correlation_id
        ) VALUES (
          'database_cleared',
          'system',
          jsonb_build_object(
            'deleted_messages', deleted_messages,
            'deleted_other_messages', deleted_other_messages,
            'operation', 'clear_all_messages',
            'timestamp', now()
          ),
          'clear_all_' || gen_random_uuid()
        );
        
        -- Return the result as JSON
        result_json := jsonb_build_object(
          'deleted_messages', deleted_messages,
          'deleted_other_messages', deleted_other_messages,
          'timestamp', now()
        );
        
        RETURN result_json;
      END;
      $$;
    `;
    
    const { error } = await supabase.rpc('xdelo_execute_sql_query', {
      p_query: sql,
      p_params: []
    });
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully created xdelo_clear_all_messages function'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error executing SQL migration:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

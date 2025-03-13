
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Executes SQL migrations safely in a transaction
 */
async function executeSqlMigration(req: Request): Promise<Response> {
  try {
    // Extract correlation ID for tracing
    const correlationId = crypto.randomUUID();
    console.log(`[${correlationId}] Starting SQL migration`);
    
    // Define SQL script - we'll drop old functions that manually created URLs
    const sqlScript = `
      -- Drop the functions for manual URL generation
      DROP FUNCTION IF EXISTS xdelo_update_public_urls(p_message_ids uuid[], p_bucket_name text);
      DROP FUNCTION IF EXISTS xdelo_generate_public_url(p_storage_path text, p_bucket_name text);
      DROP FUNCTION IF EXISTS fix_message_public_urls();
      DROP FUNCTION IF EXISTS fix_media_public_urls();
      
      -- Add function to update URLs properly using Supabase storage path
      CREATE OR REPLACE FUNCTION xdelo_fix_public_urls(
        p_limit integer DEFAULT 100
      ) 
      RETURNS TABLE (
        message_id uuid,
        old_url text,
        new_url text
      ) 
      LANGUAGE plpgsql
      AS $$
      DECLARE
        supabase_url text;
        bucket_name text := 'telegram-media';
      BEGIN
        -- Get Supabase URL from settings if available
        SELECT value INTO supabase_url FROM app_settings WHERE key = 'SUPABASE_URL';
        IF supabase_url IS NULL THEN
          -- Fallback to hardcoded URL if setting not found
          supabase_url := 'https://xjhhehxcxkiumnwbirel.supabase.co';
        END IF;
        
        RETURN QUERY
        WITH updated_messages AS (
          UPDATE messages
          SET 
            public_url = supabase_url || '/storage/v1/object/public/' || bucket_name || '/' || storage_path,
            updated_at = NOW()
          WHERE 
            storage_path IS NOT NULL 
            AND storage_path != '' 
            AND (
              public_url IS NULL 
              OR public_url = '' 
              OR public_url NOT LIKE '%/storage/v1/object/public/%'
              OR public_url NOT LIKE (supabase_url || '%')
            )
          ORDER BY created_at DESC
          LIMIT p_limit
          RETURNING id, public_url, storage_path
        )
        SELECT 
          id, 
          'invalid_or_missing', 
          public_url
        FROM updated_messages;
      END;
      $$;
      
      -- Call the function to update URLs for recent messages
      SELECT * FROM xdelo_fix_public_urls(500);
    `;
    
    // Execute the migration
    const { data, error } = await supabaseClient.rpc('xdelo_execute_sql_query', {
      p_query: sqlScript,
      p_params: []
    });
    
    if (error) {
      console.error(`[${correlationId}] Migration error:`, error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    console.log(`[${correlationId}] Migration completed successfully`);
    return new Response(
      JSON.stringify({
        success: true,
        data,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error during migration:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Handle all HTTP requests
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    return await executeSqlMigration(req);
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

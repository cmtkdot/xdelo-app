
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// SQL script to drop deprecated functions
const sqlScript = `
-- Drop deprecated functions that deal with URL generation
DROP FUNCTION IF EXISTS public.generate_public_url(text, text);
DROP FUNCTION IF EXISTS public.update_message_public_urls(uuid[]);
DROP FUNCTION IF EXISTS public.fix_media_public_urls();
DROP FUNCTION IF EXISTS public.fix_message_public_urls();
DROP FUNCTION IF EXISTS public.fix_public_urls();

-- Create a new function that uses Supabase's built-in URL handling
CREATE OR REPLACE FUNCTION xdelo_update_message_urls(
  p_message_ids uuid[] DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  old_url text,
  new_url text
)
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  bucket_name text := 'telegram-media';
BEGIN
  -- Get Supabase URL from environment/settings
  SELECT value INTO supabase_url FROM app_settings WHERE key = 'SUPABASE_URL';
  
  IF supabase_url IS NULL THEN
    -- Fallback to hardcoded value if not found
    supabase_url := 'https://xjhhehxcxkiumnwbirel.supabase.co';
  END IF;
  
  -- Return updated messages
  RETURN QUERY
  WITH messages_to_update AS (
    SELECT m.id, m.storage_path, m.public_url
    FROM messages m
    WHERE 
      m.storage_path IS NOT NULL
      AND m.storage_path != ''
      AND (
        -- Either specific message IDs were provided
        (p_message_ids IS NOT NULL AND m.id = ANY(p_message_ids))
        -- Or we're looking for messages with missing/invalid URLs
        OR (
          p_message_ids IS NULL AND (
            m.public_url IS NULL
            OR m.public_url = ''
            OR m.public_url NOT LIKE (supabase_url || '/storage/v1/object/public/%')
          )
        )
      )
    ORDER BY m.created_at DESC
    LIMIT p_limit
  ),
  updated AS (
    UPDATE messages m
    SET 
      public_url = supabase_url || '/storage/v1/object/public/' || bucket_name || '/' || mtu.storage_path,
      updated_at = NOW()
    FROM messages_to_update mtu
    WHERE m.id = mtu.id
    RETURNING m.id, mtu.public_url AS old_url, m.public_url AS new_url
  )
  SELECT * FROM updated;
END;
$$;

-- Test the new function with a small batch
SELECT * FROM xdelo_update_message_urls(NULL, 10);
`;

/**
 * Executes the SQL cleanup script
 */
async function handleRequest(): Promise<Response> {
  try {
    console.log('Executing DB cleanup script');
    
    // Execute the SQL script
    const { data, error } = await supabaseClient.rpc('xdelo_execute_sql_query', {
      p_query: sqlScript
    });
    
    if (error) {
      throw new Error(`Error executing SQL script: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully cleaned up deprecated database functions',
        data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cleanup operation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Handle all requests
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  return await handleRequest();
});

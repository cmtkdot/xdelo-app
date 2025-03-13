
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// SQL script to drop deprecated functions and create standardized URL handling
const sqlScript = `
-- Drop deprecated functions that deal with URL generation
DROP FUNCTION IF EXISTS public.generate_public_url(text, text);
DROP FUNCTION IF EXISTS public.update_message_public_urls(uuid[]);
DROP FUNCTION IF EXISTS public.fix_media_public_urls();
DROP FUNCTION IF EXISTS public.fix_message_public_urls();
DROP FUNCTION IF EXISTS public.fix_public_urls();

-- Create a new function that uses Supabase's built-in URL handling and standardized paths
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
            OR m.public_url NOT LIKE '%' || m.storage_path
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
      updated_at = NOW(),
      storage_path_standardized = TRUE
    FROM messages_to_update mtu
    WHERE m.id = mtu.id
    RETURNING m.id, mtu.public_url AS old_url, m.public_url AS new_url
  )
  SELECT * FROM updated;
END;
$$;

-- Create a new comprehensive function to standardize storage paths
CREATE OR REPLACE FUNCTION xdelo_fix_storage_paths(
  p_message_ids uuid[] DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_only_check boolean DEFAULT false
) 
RETURNS TABLE (
  message_id uuid,
  old_path text,
  new_path text,
  old_url text,
  new_url text,
  fixed boolean,
  needs_redownload boolean,
  reason text
) 
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  bucket_name text := 'telegram-media';
  rec record;
  std_extension text;
  std_path text;
  new_public_url text;
BEGIN
  -- Get Supabase URL
  SELECT value INTO supabase_url FROM app_settings WHERE key = 'SUPABASE_URL';
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://xjhhehxcxkiumnwbirel.supabase.co';
  END IF;
  
  -- Loop through messages that need standardization
  FOR rec IN (
    SELECT 
      m.id, 
      m.file_unique_id, 
      m.mime_type, 
      m.mime_type_original,
      m.storage_path, 
      m.public_url
    FROM messages m
    WHERE 
      m.file_unique_id IS NOT NULL AND
      (
        -- Process specific message IDs if provided
        (p_message_ids IS NOT NULL AND m.id = ANY(p_message_ids))
        -- Or find messages with non-standard paths or URLs
        OR (
          p_message_ids IS NULL AND (
            m.storage_path_standardized IS NULL OR 
            m.storage_path_standardized = FALSE OR
            m.public_url IS NULL OR
            m.public_url = '' OR
            m.public_url NOT LIKE (supabase_url || '%')
          )
        )
      )
    ORDER BY m.created_at DESC
    LIMIT p_limit
  ) LOOP
    -- Skip messages with missing file_unique_id
    IF rec.file_unique_id IS NULL THEN
      message_id := rec.id;
      old_path := rec.storage_path;
      new_path := NULL;
      old_url := rec.public_url;
      new_url := NULL;
      fixed := FALSE;
      needs_redownload := FALSE;
      reason := 'Missing file_unique_id';
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Get proper extension based on MIME type
    IF rec.mime_type LIKE 'image/jpeg' OR rec.mime_type_original LIKE 'image/jpeg' THEN
      std_extension := 'jpg';
    ELSIF rec.mime_type LIKE 'image/%' THEN
      std_extension := split_part(rec.mime_type, '/', 2);
    ELSIF rec.mime_type LIKE 'video/quicktime' THEN
      std_extension := 'mov';
    ELSIF rec.mime_type LIKE 'video/%' THEN
      std_extension := split_part(rec.mime_type, '/', 2);
    ELSIF rec.mime_type LIKE 'audio/mpeg' THEN
      std_extension := 'mp3';
    ELSIF rec.mime_type LIKE 'audio/%' THEN
      std_extension := split_part(rec.mime_type, '/', 2);
    ELSE
      -- Extract extension from current storage path if possible
      std_extension := split_part(rec.storage_path, '.', 2);
      IF std_extension = '' OR std_extension IS NULL THEN
        std_extension := 'bin';
      END IF;
    END IF;
    
    -- Handle special cases for standardization
    IF std_extension = 'jpeg' THEN std_extension := 'jpg'; END IF;
    IF std_extension = 'mpeg' THEN std_extension := 'mp3'; END IF;
    
    -- Generate standardized path
    std_path := rec.file_unique_id || '.' || std_extension;
    
    -- Generate expected public URL
    new_public_url := supabase_url || '/storage/v1/object/public/' || bucket_name || '/' || std_path;
    
    -- Check if path needs updating
    IF rec.storage_path != std_path OR rec.public_url != new_public_url THEN
      -- If not just checking, update the database
      IF NOT p_only_check THEN
        UPDATE messages 
        SET 
          storage_path = std_path,
          public_url = new_public_url,
          storage_path_standardized = TRUE,
          updated_at = NOW()
        WHERE id = rec.id;
      END IF;
      
      message_id := rec.id;
      old_path := rec.storage_path;
      new_path := std_path;
      old_url := rec.public_url;
      new_url := new_public_url;
      fixed := TRUE;
      needs_redownload := FALSE;
      reason := 'Path standardized';
      RETURN NEXT;
    ELSE
      -- Path already correct
      message_id := rec.id;
      old_path := rec.storage_path;
      new_path := std_path;
      old_url := rec.public_url;
      new_url := new_public_url;
      fixed := FALSE;
      needs_redownload := FALSE;
      reason := 'Already standardized';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Test the new function with a small batch
SELECT * FROM xdelo_fix_storage_paths(NULL, 10, TRUE);
`;

/**
 * Executes the SQL cleanup script
 */
async function handleRequest(): Promise<Response> {
  try {
    console.log('Executing DB cleanup script');
    
    // Check if app_settings table exists
    const { data: tableExists, error: tableCheckError } = await supabaseClient
      .from('pg_tables')
      .select('*')
      .eq('tablename', 'app_settings')
      .maybeSingle();
      
    // If app_settings doesn't exist, create it
    if (tableCheckError || !tableExists) {
      console.log('app_settings table not found, creating it');
      await supabaseClient.rpc('xdelo_execute_sql_query', {
        p_query: `
          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Insert Supabase URL if it doesn't exist
          INSERT INTO app_settings (key, value)
          VALUES ('SUPABASE_URL', 'https://xjhhehxcxkiumnwbirel.supabase.co')
          ON CONFLICT (key) DO NOTHING;
        `
      });
    }
    
    // Execute the main SQL script
    const { data, error } = await supabaseClient.rpc('xdelo_execute_sql_query', {
      p_query: sqlScript
    });
    
    if (error) {
      throw new Error(`Error executing SQL script: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully cleaned up deprecated database functions and implemented standardized path handling',
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

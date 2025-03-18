
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// SQL script to create the trigger and drop deprecated functions
const sqlScript = `
-- Create public URL trigger function
CREATE OR REPLACE FUNCTION xdelo_set_public_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.storage_path IS NOT NULL AND NEW.storage_path != '' THEN
    NEW.public_url = 'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || NEW.storage_path;
    NEW.storage_path_standardized = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_public_url' 
    AND tgrelid = 'messages'::regclass
  ) THEN
    CREATE TRIGGER set_public_url
    BEFORE INSERT OR UPDATE OF storage_path
    ON messages
    FOR EACH ROW
    EXECUTE FUNCTION xdelo_set_public_url();
  END IF;
END $$;

-- Drop deprecated functions that deal with URL generation
DROP FUNCTION IF EXISTS public.generate_public_url(text, text);
DROP FUNCTION IF EXISTS public.update_message_public_urls(uuid[]);
DROP FUNCTION IF EXISTS public.fix_media_public_urls();
DROP FUNCTION IF EXISTS public.fix_message_public_urls();
DROP FUNCTION IF EXISTS public.fix_public_urls();
DROP FUNCTION IF EXISTS public.xdelo_construct_public_url(text, text);
DROP FUNCTION IF EXISTS public.xdelo_ensure_app_settings_exists(text);

-- Run a batch update to apply the new standardized URLs to existing records
UPDATE messages
SET public_url = 'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || storage_path,
    storage_path_standardized = TRUE
WHERE storage_path IS NOT NULL AND storage_path != '';
`;

/**
 * Executes the SQL cleanup script
 */
async function handleRequest(): Promise<Response> {
  try {
    console.log('Executing DB cleanup script');
    
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
        message: 'Successfully set up public_url trigger and cleaned up deprecated database functions',
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

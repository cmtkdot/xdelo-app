
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSqlQuery } from '@/hooks/useSqlQuery';
import { Spinner } from "@/components/ui/spinner";
import { Database } from "lucide-react";

// SQL to fix public URLs
const fixPublicUrlsSql = `
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

export function MigrationButton() {
  const { executeQuery, isExecuting, results } = useSqlQuery();

  const handleRunMigration = async () => {
    await executeQuery(fixPublicUrlsSql);
  };

  return (
    <div className="p-4 space-y-4 border rounded-md bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">Run URL Migration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This will update public URLs for media files using Supabase's storage path format.
          It drops old URL generation functions and creates a new xdelo_fix_public_urls function.
        </p>
      </div>
      
      <Button
        onClick={handleRunMigration}
        disabled={isExecuting}
        className="w-full flex items-center justify-center gap-2"
        variant="default"
      >
        {isExecuting ? (
          <>
            <Spinner className="h-4 w-4" />
            Running Migration...
          </>
        ) : (
          <>
            <Database className="h-4 w-4" />
            Run URL Migration
          </>
        )}
      </Button>
      
      {results && (
        <div className="mt-2 p-3 text-sm border rounded bg-gray-100 dark:bg-gray-800">
          <div className="font-medium mb-1">
            {results.success ? (
              <span className="text-green-600 dark:text-green-400">Migration Successful</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">Migration Failed</span>
            )}
          </div>
          <div className="text-xs">
            {results.success 
              ? `Updated ${results.data?.length || 0} message URLs` 
              : `Error: ${results.error}`
            }
          </div>
        </div>
      )}
    </div>
  );
}

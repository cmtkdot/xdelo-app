
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSqlQuery } from '@/hooks/useSqlQuery';
import { Spinner } from "@/components/ui/spinner";
import { Database } from "lucide-react";

// SQL to fix public URLs using standardized storage paths
const fixPublicUrlsSql = `
-- First ensure app_settings table exists
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

-- Drop any old URL generation functions
DROP FUNCTION IF EXISTS xdelo_update_public_urls(p_message_ids uuid[], p_bucket_name text);
DROP FUNCTION IF EXISTS xdelo_generate_public_url(p_storage_path text, p_bucket_name text);
DROP FUNCTION IF EXISTS fix_message_public_urls();
DROP FUNCTION IF EXISTS fix_media_public_urls();
DROP FUNCTION IF EXISTS fix_public_urls();

-- Add standardized function to fix public URLs with consistent storage paths
CREATE OR REPLACE FUNCTION xdelo_fix_public_urls(
  p_limit integer DEFAULT 500 
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
  WITH messages_to_update AS (
    SELECT 
      m.id, 
      m.storage_path, 
      m.public_url,
      m.file_unique_id,
      m.mime_type,
      m.mime_type_original
    FROM messages m
    WHERE 
      m.storage_path IS NOT NULL 
      AND m.storage_path != '' 
      AND (
        m.public_url IS NULL 
        OR m.public_url = '' 
        OR m.public_url NOT LIKE '%/storage/v1/object/public/%'
        OR m.public_url NOT LIKE (supabase_url || '%')
        OR m.storage_path_standardized IS NULL
        OR m.storage_path_standardized = FALSE
      )
    ORDER BY m.created_at DESC
    LIMIT p_limit
  ),
  standardized_paths AS (
    SELECT
      id,
      storage_path AS old_storage_path,
      public_url AS old_public_url,
      -- Standardize file extensions based on mime type
      CASE
        WHEN mime_type LIKE 'image/jpeg' OR mime_type_original LIKE 'image/jpeg' 
          THEN file_unique_id || '.jpg'
        WHEN mime_type LIKE 'video/quicktime' 
          THEN file_unique_id || '.mov'
        WHEN mime_type LIKE 'audio/mpeg' 
          THEN file_unique_id || '.mp3'
        WHEN storage_path LIKE '%.%' 
          THEN file_unique_id || '.' || split_part(storage_path, '.', 2)
        ELSE file_unique_id || '.bin'
      END AS new_storage_path
    FROM messages_to_update
  ),
  updated_messages AS (
    UPDATE messages m
    SET 
      storage_path = sp.new_storage_path,
      public_url = supabase_url || '/storage/v1/object/public/' || bucket_name || '/' || sp.new_storage_path,
      storage_path_standardized = TRUE,
      updated_at = NOW()
    FROM standardized_paths sp
    WHERE m.id = sp.id
    RETURNING 
      m.id, 
      sp.old_public_url, 
      m.public_url
  )
  SELECT 
    id, 
    old_public_url, 
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
          This will update storage paths and public URLs for media files using standardized formats.
          It ensures consistent path generation across the application.
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
            Run Storage Path Standardization
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
              ? `Updated ${results.data?.length || 0} message storage paths and URLs` 
              : `Error: ${results.error}`
            }
          </div>
        </div>
      )}
    </div>
  );
}

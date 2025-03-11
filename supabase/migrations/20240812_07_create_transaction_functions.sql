
-- Start transaction
BEGIN;

-- Create consolidated function for transaction handling with commit and media group sync
CREATE OR REPLACE FUNCTION public.xdelo_begin_transaction()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'transaction_id', gen_random_uuid(),
    'timestamp', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.xdelo_commit_transaction_with_sync(
  p_message_id uuid, 
  p_media_group_id text, 
  p_correlation_id text,
  p_force_sync boolean DEFAULT true,
  p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- If message has a media group ID, sync with group
  IF p_media_group_id IS NOT NULL AND p_force_sync THEN
    SELECT * INTO v_result
    FROM xdelo_sync_media_group_content(
      p_message_id,
      p_media_group_id,
      p_correlation_id,
      true, -- Force sync
      p_sync_edit_history  -- Sync edit history if requested
    );
  ELSE
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Transaction committed, no media group to sync',
      'message_id', p_message_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Commit transaction
COMMIT;

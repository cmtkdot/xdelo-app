
-- Start transaction
BEGIN;

-- Recreate the media group history sync function and trigger
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- When old_analyzed_content changes, sync to media group
  IF NEW.old_analyzed_content IS DISTINCT FROM OLD.old_analyzed_content 
     AND NEW.media_group_id IS NOT NULL THEN
    
    UPDATE messages
    SET old_analyzed_content = NEW.old_analyzed_content,
        edit_history = NEW.edit_history,
        updated_at = NOW()
    WHERE media_group_id = NEW.media_group_id 
    AND id != NEW.id;
    
    -- Log the sync operation
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'media_group_history_synced',
      NEW.id,
      NEW.correlation_id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'sync_type', 'history'
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER xdelo_media_group_history_sync
  AFTER UPDATE OF old_analyzed_content ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_sync_media_group_history();

-- Commit transaction
COMMIT;

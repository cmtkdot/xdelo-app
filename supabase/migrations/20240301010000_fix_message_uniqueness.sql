
-- Remove existing constraints to clean up
DROP INDEX IF EXISTS unique_active_file_in_chat;
DROP INDEX IF EXISTS messages_unique_file_in_chat;
DROP INDEX IF EXISTS idx_messages_forward_lookup;

-- Create a unique index that allows forwards and respects chat context
CREATE UNIQUE INDEX messages_unique_file_in_chat
ON messages (file_unique_id, chat_id)
WHERE deleted_from_telegram = false AND is_forward = false;

-- Add an index to improve forward lookups
CREATE INDEX idx_messages_forward_lookup 
ON messages (file_unique_id, is_forward) 
WHERE deleted_from_telegram = false;

-- Create function to sync media history
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_history()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
    PERFORM xdelo_log_event(
      'media_group_history_synced'::audit_event_type,
      NEW.id,
      NEW.telegram_message_id,
      NEW.chat_id,
      jsonb_build_object('previous_state', OLD.old_analyzed_content),
      jsonb_build_object('new_state', NEW.old_analyzed_content),
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'sync_type', 'history'
      ),
      NEW.correlation_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create function to handle both forwards and caption updates
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If caption changed, this will trigger a re-analysis
    IF NEW.caption != OLD.caption OR (NEW.caption IS NOT NULL AND OLD.caption IS NULL) THEN
        -- Reset analysis state
        NEW.analyzed_content = NULL;
        NEW.processing_state = 'pending';
        NEW.group_caption_synced = false;
        
        -- Add to edit history
        NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
            'edit_date', CURRENT_TIMESTAMP,
            'previous_caption', OLD.caption,
            'new_caption', NEW.caption,
            'is_channel_post', NEW.chat_type = 'channel',
            'previous_analyzed_content', OLD.analyzed_content
        );
        
        -- Log the edit
        PERFORM xdelo_log_event(
            'message_edited'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object('caption', OLD.caption, 'analyzed_content', OLD.analyzed_content),
            jsonb_build_object('caption', NEW.caption),
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'is_channel_post', NEW.chat_type = 'channel'
            ),
            NEW.correlation_id
        );
        
        -- If part of media group, update all related messages
        IF NEW.media_group_id IS NOT NULL THEN
            UPDATE messages
            SET 
                analyzed_content = NULL,
                processing_state = 'pending',
                group_caption_synced = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                media_group_id = NEW.media_group_id 
                AND id != NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Add trigger for media group history syncing
DROP TRIGGER IF EXISTS xdelo_media_group_history_sync ON messages;
CREATE TRIGGER xdelo_media_group_history_sync
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_sync_media_group_history();

-- Add trigger for message updates
DROP TRIGGER IF EXISTS xdelo_trg_message_update ON messages;
CREATE TRIGGER xdelo_trg_message_update
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_handle_message_update();

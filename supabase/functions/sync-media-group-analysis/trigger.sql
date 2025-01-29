-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_sync_media_group_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for messages that are part of a media group
  IF NEW.media_group_id IS NOT NULL AND
     (NEW.analyzed_content IS NOT NULL AND NEW.analyzed_content != '{}'::jsonb) AND
     NEW.processing_state = 'analysis_synced' THEN

    -- Make HTTP request to the Edge Function
    PERFORM net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/sync-media-group-analysis'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'media_group_id', NEW.media_group_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE OR REPLACE TRIGGER sync_media_group_analysis_trigger
AFTER UPDATE OF analyzed_content ON messages
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_media_group_analysis();

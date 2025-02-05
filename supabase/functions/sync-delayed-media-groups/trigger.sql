-- Enable the pg_net extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to schedule delayed sync
CREATE OR REPLACE FUNCTION schedule_delayed_sync()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  edge_function text := 'sync-delayed-media-groups';
  delay_interval interval := interval '1 minute';
BEGIN
  -- Only schedule for messages with media groups
  IF NEW.media_group_id IS NOT NULL THEN
    -- Create empty payload
    payload := '{}'::jsonb;
    
    -- Add delay
    PERFORM pg_sleep(EXTRACT(EPOCH FROM delay_interval));
    
    -- Call the edge function
    PERFORM 
      net.http_post(
        url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/' || edge_function,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := payload,
        timeout_milliseconds := 0
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs after message insert/update
DROP TRIGGER IF EXISTS delayed_sync_trigger ON messages;
CREATE TRIGGER delayed_sync_trigger
  AFTER INSERT OR UPDATE
  ON messages
  FOR EACH ROW
  WHEN (NEW.media_group_id IS NOT NULL AND 
        NEW.processing_state IN ('initialized', 'pending', 'error', 'processing'))
  EXECUTE FUNCTION schedule_delayed_sync();

-- Create a separate function to manually trigger sync for a media group
CREATE OR REPLACE FUNCTION manual_sync_media_group(p_media_group_id text)
RETURNS void AS $$
DECLARE
  payload jsonb;
  edge_function text := 'sync-delayed-media-groups';
BEGIN
  -- Create payload with media group id
  payload := jsonb_build_object('media_group_id', p_media_group_id);
  
  -- Call the edge function immediately
  PERFORM 
    net.http_post(
      url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/' || edge_function,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := payload,
      timeout_milliseconds := 0
    );
END;
$$ LANGUAGE plpgsql;

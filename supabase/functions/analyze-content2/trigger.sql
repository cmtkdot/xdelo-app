-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_analyze_content2()
RETURNS TRIGGER AS $$
BEGIN
  -- Make HTTP request to the Edge Function
  SELECT net.http_post(
    url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/analyze-content2'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE OR REPLACE TRIGGER analyze_content2_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL)
EXECUTE FUNCTION trigger_analyze_content2();
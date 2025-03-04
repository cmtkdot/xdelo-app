
-- Create a new migration for direct caption analysis
-- This removes the message queue system and implements direct triggers

-- 1. Create a new function to directly analyze captions
CREATE OR REPLACE FUNCTION public.xdelo_direct_caption_analysis(
  p_message_id uuid,
  p_caption text,
  p_media_group_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_public_url text;
  v_file_unique_id text;
  v_mime_type text;
  v_storage_path text;
BEGIN
  -- Mark message as processing
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = NOW(),
    direct_processing_attempts = COALESCE(direct_processing_attempts, 0) + 1,
    last_processing_attempt = NOW()
  WHERE id = p_message_id;
  
  -- Get file info for the edge function
  SELECT 
    public_url, 
    file_unique_id,
    mime_type,
    storage_path
  INTO 
    v_public_url, 
    v_file_unique_id,
    v_mime_type,
    v_storage_path
  FROM messages
  WHERE id = p_message_id;
  
  -- Log the analysis attempt
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id
  ) VALUES (
    'caption_analysis_requested',
    p_message_id,
    jsonb_build_object(
      'caption', p_caption,
      'media_group_id', p_media_group_id,
      'direct_trigger', true
    ),
    p_correlation_id
  );
  
  -- Return the info needed for the edge function
  RETURN jsonb_build_object(
    'message_id', p_message_id,
    'caption', p_caption,
    'media_group_id', p_media_group_id,
    'correlation_id', p_correlation_id,
    'file_info', jsonb_build_object(
      'public_url', v_public_url,
      'file_unique_id', v_file_unique_id,
      'mime_type', v_mime_type,
      'storage_path', v_storage_path
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error and update message
  UPDATE messages
  SET 
    processing_state = 'error',
    error_message = SQLERRM,
    last_error_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the error
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    error_message,
    correlation_id
  ) VALUES (
    'caption_analysis_error',
    p_message_id,
    SQLERRM,
    p_correlation_id
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 2. Create a trigger function for caption changes
CREATE OR REPLACE FUNCTION public.xdelo_trigger_caption_analysis()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id text;
  v_edge_response json;
  v_analysis_data jsonb;
BEGIN
  -- Skip processing if conditions aren't met
  IF NEW.caption IS NULL OR trim(NEW.caption) = '' OR 
     NEW.analyzed_content IS NOT NULL OR
     NEW.processing_state IN ('processing', 'completed') THEN
    RETURN NEW;
  END IF;
  
  -- Generate correlation ID if needed
  v_correlation_id := COALESCE(NEW.correlation_id, gen_random_uuid()::text);
  
  -- For media groups without caption, check if we can sync from another message
  IF NEW.media_group_id IS NOT NULL AND (NEW.caption IS NULL OR trim(NEW.caption) = '') THEN
    -- Try to sync from existing analyzed content in the group
    PERFORM xdelo_check_media_group_content(
      NEW.media_group_id,
      NEW.id,
      v_correlation_id
    );
    
    -- If sync succeeded (or failed definitively), don't continue
    SELECT analyzed_content INTO v_analysis_data
    FROM messages
    WHERE id = NEW.id;
    
    IF v_analysis_data IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Only proceed with direct analysis for messages with captions
  IF NEW.caption IS NOT NULL AND trim(NEW.caption) != '' THEN
    -- Get analysis data
    v_analysis_data := xdelo_direct_caption_analysis(
      NEW.id,
      NEW.caption,
      NEW.media_group_id,
      v_correlation_id
    );
    
    -- Call the edge function directly using pg_net
    -- Don't wait for the response - it will update the message asynchronously
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/parse-caption-with-ai',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := v_analysis_data
    );
    
    -- Log the edge function invocation
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      metadata,
      correlation_id
    ) VALUES (
      'parse_caption_function_called',
      NEW.id,
      jsonb_build_object(
        'caption_length', length(NEW.caption),
        'media_group_id', NEW.media_group_id,
        'async', true
      ),
      v_correlation_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Add required columns to the messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS direct_processing_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_processing_attempt timestamp with time zone;

-- 4. Create new triggers on messages table
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
CREATE TRIGGER xdelo_direct_caption_analysis_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_trigger_caption_analysis();

-- 5. Create scheduling function for periodic processing
CREATE OR REPLACE FUNCTION public.xdelo_schedule_caption_processing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed_count integer := 0;
  v_message record;
  v_correlation_id text;
  v_analysis_data jsonb;
BEGIN
  -- Find messages with captions but no analysis
  FOR v_message IN 
    SELECT id, caption, media_group_id, correlation_id
    FROM messages
    WHERE 
      caption IS NOT NULL 
      AND trim(caption) != ''
      AND analyzed_content IS NULL
      AND processing_state IN ('initialized', 'pending', 'error')
      AND (last_processing_attempt IS NULL OR last_processing_attempt < NOW() - interval '1 hour')
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    -- Generate correlation ID
    v_correlation_id := COALESCE(v_message.correlation_id, 'scheduled-' || gen_random_uuid()::text);
    
    -- Call direct analysis function
    v_analysis_data := xdelo_direct_caption_analysis(
      v_message.id,
      v_message.caption,
      v_message.media_group_id,
      v_correlation_id
    );
    
    -- Call edge function
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/parse-caption-with-ai',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := v_analysis_data
    );
    
    v_processed_count := v_processed_count + 1;
  END LOOP;
  
  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count
  );
END;
$$;

-- 6. Setup a scheduled task to periodically process messages
SELECT cron.schedule(
  'process-message-captions',
  '*/10 * * * *', -- Run every 10 minutes
  $$
  SELECT xdelo_schedule_caption_processing();
  $$
);

-- IMPORTANT: Enable the required extensions if not already enabled
-- This will only execute if pg_net and pg_cron are not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

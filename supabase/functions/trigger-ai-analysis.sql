CREATE OR REPLACE FUNCTION public.trigger_ai_analysis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only trigger analysis for messages in caption_ready state
    IF NEW.processing_state = 'caption_ready' AND 
       (OLD.processing_state IS NULL OR OLD.processing_state != 'caption_ready') THEN
        
        -- Update state to analyzing before making request
        NEW.processing_state := 'analyzing';
        NEW.processing_started_at := NOW();
        
        -- Make HTTP request to parse-caption-with-ai function
        PERFORM http_post(
            url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/parse-caption-with-ai'),
            headers := jsonb_build_object(
                'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key')),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'message_id', NEW.id,
                'media_group_id', NEW.media_group_id,
                'caption', NEW.caption
            )
        );
    END IF;
    RETURN NEW;
END;
$$;
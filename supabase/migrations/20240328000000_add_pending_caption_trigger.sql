
-- Create function to handle pending messages with captions
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_captions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only proceed if the message has a caption and is in pending state
    IF NEW.caption IS NOT NULL AND NEW.processing_state = 'pending' THEN
        -- Generate a correlation ID for tracking
        NEW.processing_correlation_id = gen_random_uuid();
        
        -- Invoke the Edge Function for caption parsing
        PERFORM supabase.functions.http_request(
            'https://xjhhehxcxkiumnwbirel.supabase.co/functions/v1/parse-caption-with-ai',
            'POST',
            jsonb_build_object('Content-Type', 'application/json'),
            jsonb_build_object(
                'messageId', NEW.id,
                'media_group_id', NEW.media_group_id,
                'caption', NEW.caption,
                'correlationId', NEW.processing_correlation_id
            )::text,
            1000
        );
        
        -- Log the event
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            telegram_message_id,
            chat_id,
            metadata,
            correlation_id
        ) VALUES (
            'caption_processing_initiated',
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object(
                'caption_length', length(NEW.caption),
                'media_group_id', NEW.media_group_id,
                'processing_state', NEW.processing_state
            ),
            NEW.processing_correlation_id
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger on messages table
CREATE TRIGGER xdelo_trg_process_pending_captions
    AFTER INSERT OR UPDATE OF caption, processing_state
    ON public.messages
    FOR EACH ROW
    WHEN (NEW.caption IS NOT NULL AND NEW.processing_state = 'pending')
    EXECUTE FUNCTION public.xdelo_process_pending_captions();

-- Add comment to explain trigger purpose
COMMENT ON TRIGGER xdelo_trg_process_pending_captions ON public.messages
    IS 'Triggers caption analysis for messages with pending state and non-null captions';


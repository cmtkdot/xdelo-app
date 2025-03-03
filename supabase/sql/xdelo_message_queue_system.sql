
-- First drop existing trigger that depends on the function
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;

-- Drop existing function for message queuing
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing(uuid, text);
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing(uuid, uuid);
DROP FUNCTION IF EXISTS xdelo_get_next_message_for_processing();
DROP FUNCTION IF EXISTS xdelo_complete_message_processing(uuid, jsonb);
DROP FUNCTION IF EXISTS xdelo_fail_message_processing(uuid, text);

-- Drop existing tables if they exist
DROP TABLE IF EXISTS message_processing_queue;

-- Create new message queue table
CREATE TABLE IF NOT EXISTS telegram_message_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    correlation_id text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    processing_started_at timestamptz,
    processing_completed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    priority integer NOT NULL DEFAULT 0,
    error text,
    last_error_at timestamptz,
    metadata jsonb,
    processor_id text
);

-- Create indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_status_priority 
    ON telegram_message_queue(status, priority DESC, created_at ASC);
    
CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_message_id 
    ON telegram_message_queue(message_id);
    
CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_correlation_id 
    ON telegram_message_queue(correlation_id);

-- Function to check if a caption is valid for processing
CREATE OR REPLACE FUNCTION xdelo_has_valid_caption(p_caption TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caption exists and isn't empty
  RETURN p_caption IS NOT NULL AND trim(p_caption) <> '';
END;
$$ LANGUAGE plpgsql;

-- Function to queue a message for processing
CREATE OR REPLACE FUNCTION tg_queue_message(
    p_message_id uuid,
    p_correlation_id text DEFAULT NULL,
    p_priority integer DEFAULT 0
) RETURNS uuid AS $$
DECLARE
    v_queue_id uuid;
    v_caption text;
    v_media_group_id text;
BEGIN
    -- Get message caption and media_group_id
    SELECT caption, media_group_id INTO v_caption, v_media_group_id
    FROM messages
    WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Only queue messages with captions
    IF NOT xdelo_has_valid_caption(v_caption) THEN
        RAISE EXCEPTION 'Message has no caption to process';
    END IF;
    
    -- Check if already queued and pending
    SELECT id INTO v_queue_id
    FROM telegram_message_queue
    WHERE message_id = p_message_id 
    AND status IN ('pending', 'processing')
    LIMIT 1;
    
    IF FOUND THEN
        -- Update existing queue entry with new priority if higher
        UPDATE telegram_message_queue
        SET priority = GREATEST(priority, p_priority),
            correlation_id = COALESCE(p_correlation_id, correlation_id)
        WHERE id = v_queue_id;
        
        RETURN v_queue_id;
    END IF;
    
    -- Insert new queue entry
    INSERT INTO telegram_message_queue (
        message_id,
        correlation_id,
        status,
        priority,
        metadata
    ) VALUES (
        p_message_id,
        p_correlation_id,
        'pending',
        p_priority,
        jsonb_build_object(
            'caption', v_caption,
            'media_group_id', v_media_group_id,
            'queue_time', NOW()
        )
    ) RETURNING id INTO v_queue_id;
    
    -- Update message processing state
    UPDATE messages
    SET 
        processing_state = 'pending',
        processing_correlation_id = p_correlation_id::uuid,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_queued_for_processing',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
            'queue_id', v_queue_id,
            'caption_length', length(v_caption),
            'media_group_id', v_media_group_id,
            'priority', p_priority
        ),
        NOW()
    );
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get the next batch of messages for processing
CREATE OR REPLACE FUNCTION tg_get_next_messages(
    limit_count integer DEFAULT 5
) RETURNS TABLE (
    queue_id uuid,
    message_id uuid,
    correlation_id text,
    caption text,
    media_group_id text,
    priority integer
) AS $$
BEGIN
    RETURN QUERY
    WITH next_messages AS (
        SELECT 
            q.id as q_id, 
            q.message_id as q_message_id,
            q.correlation_id as q_correlation_id,
            q.priority as q_priority
        FROM telegram_message_queue q
        WHERE q.status = 'pending'
        AND q.attempts < q.max_attempts
        ORDER BY q.priority DESC, q.created_at ASC
        LIMIT limit_count
        FOR UPDATE SKIP LOCKED
    )
    UPDATE telegram_message_queue q
    SET 
        status = 'processing',
        processing_started_at = NOW(),
        attempts = attempts + 1
    FROM next_messages n
    WHERE q.id = n.q_id
    RETURNING 
        q.id,
        q.message_id,
        q.correlation_id,
        (SELECT caption FROM messages WHERE id = q.message_id),
        (SELECT media_group_id FROM messages WHERE id = q.message_id),
        q.priority;
END;
$$ LANGUAGE plpgsql;

-- Function to mark queue processing as completed
CREATE OR REPLACE FUNCTION tg_complete_processing(
    p_queue_id uuid,
    p_analyzed_content jsonb
) RETURNS boolean AS $$
DECLARE
    v_message_id uuid;
    v_correlation_id text;
    v_media_group_id text;
BEGIN
    -- Get the necessary data
    SELECT message_id, correlation_id, metadata->>'media_group_id' 
    INTO v_message_id, v_correlation_id, v_media_group_id
    FROM telegram_message_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE telegram_message_queue
    SET 
        status = 'completed',
        processing_completed_at = NOW(),
        metadata = metadata || jsonb_build_object('analyzed_content', p_analyzed_content)
    WHERE id = p_queue_id;
    
    -- Update the message with analyzed content
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed',
        processing_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_completed',
        v_message_id,
        v_correlation_id,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'media_group_id', v_media_group_id,
            'product_name', p_analyzed_content->>'product_name',
            'vendor_uid', p_analyzed_content->>'vendor_uid'
        ),
        NOW()
    );
    
    -- If this is part of a media group, sync the analyzed content to other messages
    IF v_media_group_id IS NOT NULL THEN
        PERFORM xdelo_sync_media_group_content(v_message_id, v_media_group_id);
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark queue processing as failed
CREATE OR REPLACE FUNCTION tg_fail_processing(
    p_queue_id uuid,
    p_error_message text
) RETURNS boolean AS $$
DECLARE
    v_message_id uuid;
    v_correlation_id text;
    v_attempts integer;
    v_max_attempts integer;
BEGIN
    -- Get the necessary data
    SELECT message_id, correlation_id, attempts, max_attempts
    INTO v_message_id, v_correlation_id, v_attempts, v_max_attempts
    FROM telegram_message_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE telegram_message_queue
    SET 
        status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
        error = p_error_message,
        last_error_at = NOW()
    WHERE id = p_queue_id;
    
    -- Update the message with the error
    UPDATE messages
    SET 
        processing_state = CASE WHEN v_attempts >= v_max_attempts THEN 'error' ELSE 'pending' END,
        error_message = p_error_message,
        last_error_at = NOW(),
        retry_count = COALESCE(retry_count, 0) + 1,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the failure
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        CASE WHEN v_attempts >= v_max_attempts THEN 'message_processing_failed' ELSE 'message_processing_retry' END,
        v_message_id,
        v_correlation_id,
        p_error_message,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'attempts', v_attempts,
            'max_attempts', v_max_attempts
        ),
        NOW()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to queue unprocessed messages
CREATE OR REPLACE FUNCTION tg_queue_unprocessed_messages(
    limit_count integer DEFAULT 20
) RETURNS TABLE (
    message_id uuid,
    queued boolean,
    reason text
) AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT 
            m.id,
            m.caption,
            m.processing_state,
            EXISTS (
                SELECT 1 FROM telegram_message_queue q 
                WHERE q.message_id = m.id 
                AND q.status IN ('pending', 'processing')
            ) AS already_queued
        FROM messages m
        WHERE 
            m.processing_state IN ('initialized', 'pending', 'error')
            AND m.caption IS NOT NULL
            AND trim(m.caption) <> ''
            AND NOT EXISTS (
                SELECT 1 FROM telegram_message_queue q 
                WHERE q.message_id = m.id 
                AND q.status IN ('pending', 'processing')
            )
        ORDER BY 
            m.created_at DESC
        LIMIT limit_count
    )
    SELECT 
        c.id,
        CASE WHEN c.already_queued THEN FALSE
             ELSE (
                 SELECT true FROM tg_queue_message(c.id) AS queue_id
                 WHERE queue_id IS NOT NULL
             )
        END AS queued,
        CASE WHEN c.already_queued THEN 'Already in queue'
             ELSE 'Queued for processing'
        END AS reason
    FROM candidates c;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically queue messages with captions
CREATE OR REPLACE FUNCTION tg_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue messages with captions for processing
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.caption IS NULL OR OLD.caption <> NEW.caption))) 
     AND xdelo_has_valid_caption(NEW.caption) THEN
      
    -- Only if not already in processing or completed state
    IF NEW.processing_state IS NULL OR NEW.processing_state IN ('initialized', 'pending', 'error') THEN
      -- Log the trigger activation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        event_timestamp
      ) VALUES (
        'trigger_auto_queue_activated',
        NEW.id,
        jsonb_build_object(
          'correlation_id', NEW.correlation_id,
          'caption', NEW.caption,
          'processing_state', NEW.processing_state,
          'trigger_operation', TG_OP
        ),
        NOW()
      );
    
      -- Queue for processing using the new function
      BEGIN
        -- Ensure correlation_id is passed as TEXT type
        PERFORM tg_queue_message(NEW.id, NEW.correlation_id);
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the whole transaction
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          error_message,
          metadata,
          event_timestamp
        ) VALUES (
          'trigger_queue_error',
          NEW.id,
          SQLERRM,
          jsonb_build_object(
            'correlation_id', NEW.correlation_id,
            'caption', NEW.caption,
            'error_detail', SQLSTATE
          ),
          NOW()
        );
      END;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Apply the trigger to the messages table
CREATE TRIGGER tg_auto_queue_messages_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION tg_auto_queue_messages();

-- Create a view for monitoring the queue
CREATE OR REPLACE VIEW v_message_queue_status AS
SELECT 
    status,
    count(*) as message_count,
    max(priority) as max_priority,
    avg(extract(epoch from (now() - created_at)))::integer as avg_age_seconds,
    max(extract(epoch from (now() - created_at)))::integer as oldest_seconds
FROM telegram_message_queue
GROUP BY status;

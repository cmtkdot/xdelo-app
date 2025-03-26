
-- Migration to optimize message handling and prevent statement timeouts
-- This migration adds a telegram_metadata column and indexes to improve performance

-- 1. Add telegram_metadata column to messages table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'telegram_metadata'
    ) THEN
        ALTER TABLE messages ADD COLUMN telegram_metadata JSONB;
        
        -- Add a comment to document the column's purpose
        COMMENT ON COLUMN messages.telegram_metadata IS 'Lightweight metadata extracted from Telegram message, replacing large telegram_data field';
    END IF;
END$$;

-- 2. Create more efficient indexes for message lookups
DO $$
BEGIN
    -- Create a compound index for telegram_message_id and chat_id for faster lookups
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_messages_telegram_id_chat_id'
    ) THEN
        CREATE INDEX idx_messages_telegram_id_chat_id 
        ON messages(telegram_message_id, chat_id);
    END IF;
    
    -- Create an index for file_unique_id for faster duplicate file detection
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_messages_file_unique_id'
    ) THEN
        CREATE INDEX idx_messages_file_unique_id 
        ON messages(file_unique_id);
    END IF;
END$$;

-- 3. Create a function to handle long-running queries that might be causing locks
CREATE OR REPLACE FUNCTION public.xdelo_kill_long_queries(
    timeout_threshold_seconds INTEGER DEFAULT 30
) RETURNS TABLE (
    pid INTEGER,
    query_start TIMESTAMP WITH TIME ZONE,
    state TEXT,
    query TEXT,
    action TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH long_running_queries AS (
        SELECT 
            pid,
            query_start,
            state,
            query
        FROM 
            pg_stat_activity
        WHERE 
            state != 'idle' AND
            query_start < (now() - (timeout_threshold_seconds * interval '1 second')) AND
            query NOT ILIKE '%pg_stat_activity%' AND
            query NOT ILIKE '%pg_locks%'
    )
    SELECT 
        q.pid,
        q.query_start,
        q.state,
        left(q.query, 150) as query,
        CASE 
            WHEN q.state = 'active' THEN 'Terminated active query' 
            WHEN q.state = 'idle in transaction' THEN 'Terminated idle transaction'
            ELSE 'Monitored only'
        END as action
    FROM 
        long_running_queries q
    WHERE 
        (q.state = 'active' OR q.state = 'idle in transaction')
    ORDER BY 
        q.query_start ASC;
    
    -- Terminate long-running active queries
    PERFORM pg_terminate_backend(pid) 
    FROM pg_stat_activity
    WHERE 
        state = 'active' AND
        query_start < (now() - (timeout_threshold_seconds * interval '1 second')) AND
        query NOT ILIKE '%pg_stat_activity%' AND
        query NOT ILIKE '%pg_locks%';
        
    -- Terminate idle transactions (these can hold locks)
    PERFORM pg_terminate_backend(pid) 
    FROM pg_stat_activity
    WHERE 
        state = 'idle in transaction' AND
        query_start < (now() - (timeout_threshold_seconds * interval '1 second'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a procedure to migrate data from telegram_data to telegram_metadata
CREATE OR REPLACE PROCEDURE public.xdelo_migrate_telegram_data(
    batch_size INTEGER DEFAULT 100
)
LANGUAGE plpgsql
AS $$
DECLARE
    counter INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            id, telegram_data 
        FROM 
            messages 
        WHERE 
            telegram_metadata IS NULL 
            AND telegram_data IS NOT NULL
        LIMIT batch_size
    LOOP
        -- Extract minimal metadata from the telegram_data field
        UPDATE messages
        SET telegram_metadata = jsonb_build_object(
            'from_id', telegram_data->'from'->>'id',
            'from_username', telegram_data->'from'->>'username',
            'message_date', telegram_data->>'date',
            'edit_date', telegram_data->>'edit_date'
        )
        WHERE id = r.id;
        
        counter := counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Processed % records', counter;
END;
$$;

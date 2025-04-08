
-- This migration consolidates and streamlines the Telegram webhook flow functions and triggers
-- It removes redundant functions while keeping the core functionality intact

-- First, create the new consolidated functions

-- 1. Enhanced function for killing long queries
CREATE OR REPLACE FUNCTION public.xdelo_kill_long_queries(older_than_seconds integer DEFAULT 60)
RETURNS TABLE (
    pid integer,
    usename text,
    query_start timestamp with time zone,
    state text,
    query text,
    killed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH long_queries AS (
        SELECT 
            pid,
            usename,
            query_start,
            state,
            query
        FROM 
            pg_stat_activity
        WHERE 
            state != 'idle' AND
            query_start < (NOW() - (older_than_seconds || ' seconds')::interval) AND
            pid != pg_backend_pid()
    ),
    killed_queries AS (
        SELECT 
            l.pid,
            l.usename,
            l.query_start,
            l.state,
            l.query,
            pg_terminate_backend(l.pid) AS killed
        FROM long_queries l
    )
    SELECT * FROM killed_queries;
END;
$$;

-- 2. Enhanced logging function
CREATE OR REPLACE FUNCTION public.xdelo_logprocessingevent(
    p_event_type text,
    p_entity_id text,
    p_correlation_id text,
    p_metadata jsonb DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uuid uuid;
    v_metadata jsonb;
BEGIN
    -- Enhance metadata with timestamp if not provided
    v_metadata := COALESCE(p_metadata, '{}'::jsonb);
    IF NOT v_metadata ? 'timestamp' THEN
        v_metadata := v_metadata || jsonb_build_object('timestamp', now());
    END IF;
    
    -- Add correlation_id to metadata if not already present
    IF NOT v_metadata ? 'correlation_id' THEN
        v_metadata := v_metadata || jsonb_build_object('correlation_id', p_correlation_id);
    END IF;
    
    -- Insert into audit logs table
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message,
        event_timestamp
    ) VALUES (
        p_event_type,
        p_entity_id::uuid,
        p_correlation_id,
        v_metadata,
        p_error_message,
        now()
    ) RETURNING id INTO v_uuid;
    
    RETURN v_uuid;
EXCEPTION WHEN OTHERS THEN
    -- Log to server logs if audit insert fails
    RAISE WARNING 'Failed to log event: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- 3. Consolidated function for media group sync
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_source_message_id uuid,
    p_media_group_id text,
    p_correlation_id text DEFAULT NULL,
    p_force_sync boolean DEFAULT false,
    p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_message record;
    v_result jsonb;
    v_updated_count integer := 0;
    v_error text;
    v_lock_acquired boolean;
BEGIN
    -- Acquire advisory lock on media group to prevent concurrent syncs
    v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_media_group_id));
  
    IF NOT v_lock_acquired THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Could not acquire lock on media group, another sync operation is in progress',
            'media_group_id', p_media_group_id
        );
    END IF;

    -- Input validation
    IF p_source_message_id IS NULL OR p_media_group_id IS NULL OR p_media_group_id = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid parameters: source_message_id and media_group_id required',
            'source_message_id', p_source_message_id,
            'media_group_id', p_media_group_id
        );
    END IF;

    -- Get the source message
    SELECT * INTO v_source_message
    FROM messages
    WHERE id = p_source_message_id
    FOR UPDATE;
  
    IF NOT FOUND OR v_source_message.analyzed_content IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Source message not found or has no analyzed content',
            'message_id', p_source_message_id
        );
    END IF;
  
    -- Mark source message as the original caption holder
    UPDATE messages
    SET 
        is_original_caption = true,
        group_caption_synced = true,
        updated_at = NOW()
    WHERE id = p_source_message_id;
  
    -- Update all other messages in the group with the analyzed content
    WITH updated_messages AS (
        UPDATE messages
        SET 
            analyzed_content = v_source_message.analyzed_content,
            processing_state = 'completed',
            group_caption_synced = true,
            message_caption_id = p_source_message_id,
            is_original_caption = false,
            processing_completed_at = COALESCE(processing_completed_at, NOW()),
            updated_at = NOW(),
            -- Only sync edit history if requested
            old_analyzed_content = CASE 
                WHEN p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL 
                THEN v_source_message.old_analyzed_content
                ELSE old_analyzed_content
            END
        WHERE 
            media_group_id = p_media_group_id 
            AND id != p_source_message_id
            AND (p_force_sync = true OR group_caption_synced = false OR analyzed_content IS NULL)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_messages;
  
    -- Update media group metadata for all messages
    WITH group_stats AS (
        SELECT 
            COUNT(*) as message_count,
            MIN(created_at) as first_message_time,
            MAX(created_at) as last_message_time
        FROM messages
        WHERE media_group_id = p_media_group_id
    )
    UPDATE messages m
    SET
        group_message_count = gs.message_count,
        group_first_message_time = gs.first_message_time,
        group_last_message_time = gs.last_message_time,
        updated_at = NOW()
    FROM group_stats gs
    WHERE m.media_group_id = p_media_group_id;
  
    -- Log the sync operation
    PERFORM xdelo_logprocessingevent(
        'media_group_content_synced',
        p_source_message_id::text,
        p_correlation_id,
        jsonb_build_object(
            'media_group_id', p_media_group_id,
            'updated_messages_count', v_updated_count,
            'force_sync', p_force_sync,
            'sync_edit_history', p_sync_edit_history
        )
    );
  
    RETURN jsonb_build_object(
        'success', true,
        'media_group_id', p_media_group_id,
        'source_message_id', p_source_message_id, 
        'updated_count', v_updated_count
    );
EXCEPTION
    WHEN OTHERS THEN
        v_error := SQLERRM;
    
        -- Log error
        PERFORM xdelo_logprocessingevent(
            'media_group_sync_error',
            p_source_message_id::text,
            p_correlation_id,
            jsonb_build_object(
                'media_group_id', p_media_group_id,
                'error', v_error
            ),
            v_error
        );
    
        RETURN jsonb_build_object(
            'success', false,
            'error', v_error,
            'media_group_id', p_media_group_id,
            'source_message_id', p_source_message_id
        );
END;
$$;

-- 4. Consolidated function for finding the best caption message in a media group
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(p_media_group_id text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_message_id uuid;
BEGIN
    -- First try to find a message that has caption and analyzed content
    SELECT id INTO v_message_id
    FROM messages
    WHERE media_group_id = p_media_group_id
      AND caption IS NOT NULL
      AND caption != ''
      AND analyzed_content IS NOT NULL
      AND is_original_caption = true
    ORDER BY created_at ASC
    LIMIT 1;
  
    IF v_message_id IS NOT NULL THEN
        RETURN v_message_id;
    END IF;
  
    -- If not found, try to find any message with caption
    SELECT id INTO v_message_id
    FROM messages
    WHERE media_group_id = p_media_group_id
      AND caption IS NOT NULL
      AND caption != ''
    ORDER BY created_at ASC
    LIMIT 1;
  
    IF v_message_id IS NOT NULL THEN
        RETURN v_message_id;
    END IF;
  
    -- If still not found, return NULL
    RETURN NULL;
END;
$$;

-- 5. Standardize file extension function
CREATE OR REPLACE FUNCTION public.xdelo_standardize_file_extension(p_mime_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_extension text;
BEGIN
    -- Map MIME types to standard extensions
    CASE 
        WHEN p_mime_type LIKE 'image/jpeg' OR p_mime_type LIKE 'image/jpg' THEN
            v_extension := 'jpg';
        WHEN p_mime_type LIKE 'image/png' THEN
            v_extension := 'png';
        WHEN p_mime_type LIKE 'image/gif' THEN
            v_extension := 'gif';
        WHEN p_mime_type LIKE 'image/webp' THEN
            v_extension := 'webp';
        WHEN p_mime_type LIKE 'video/mp4' THEN
            v_extension := 'mp4';
        WHEN p_mime_type LIKE 'video/quicktime' THEN
            v_extension := 'mov';
        WHEN p_mime_type LIKE 'application/pdf' THEN
            v_extension := 'pdf';
        WHEN p_mime_type LIKE 'application/octet-stream' THEN
            v_extension := 'bin';
        ELSE
            -- Extract the subtype from MIME type (part after /)
            v_extension := split_part(p_mime_type, '/', 2);
            -- Remove parameters if any (e.g., ";charset=utf-8")
            v_extension := split_part(v_extension, ';', 1);
            -- If extension is empty or same as full mime type, default to bin
            IF v_extension = '' OR v_extension = p_mime_type THEN
                v_extension := 'bin';
            END IF;
    END CASE;
  
    RETURN v_extension;
END;
$$;

-- 6. Fix audit log UUIDs function
CREATE OR REPLACE FUNCTION public.xdelo_fix_audit_log_uuids()
RETURNS TABLE(fixed_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH fixed AS (
        UPDATE unified_audit_logs
        SET entity_id = entity_id::text::uuid
        WHERE 
            entity_id IS NOT NULL AND
            entity_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        RETURNING id
    )
    SELECT COUNT(*) FROM fixed;
END;
$$;

-- 7. Enhanced function to migrate telegram_data to telegram_metadata
CREATE OR REPLACE FUNCTION public.migrate_telegram_data_to_metadata()
RETURNS TABLE(migrated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    batch_size integer := 1000;
    current_offset integer := 0;
    has_more boolean := true;
    migrated_batch_count integer;
    total_migrated bigint := 0;
BEGIN
    -- Process in batches to avoid locks and timeouts
    WHILE has_more LOOP
        migrated_batch_count := 0;
        
        WITH to_migrate AS (
            SELECT 
                id, 
                telegram_data 
            FROM 
                messages
            WHERE 
                telegram_metadata IS NULL 
                AND telegram_data IS NOT NULL
            ORDER BY id
            LIMIT batch_size
            OFFSET current_offset
            FOR UPDATE SKIP LOCKED
        ),
        migrated AS (
            UPDATE messages m
            SET 
                telegram_metadata = CASE
                    WHEN t.telegram_data->>'message' IS NOT NULL THEN 
                        jsonb_build_object(
                            'message_type', 'message',
                            'message_id', (t.telegram_data->'message'->>'message_id')::bigint,
                            'date', (t.telegram_data->'message'->>'date')::bigint,
                            'chat', t.telegram_data->'message'->'chat',
                            'from', t.telegram_data->'message'->'from',
                            'media_group_id', t.telegram_data->'message'->>'media_group_id',
                            'text', t.telegram_data->'message'->>'text',
                            'caption', t.telegram_data->'message'->>'caption'
                        )
                    WHEN t.telegram_data->>'channel_post' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'channel_post',
                            'message_id', (t.telegram_data->'channel_post'->>'message_id')::bigint,
                            'date', (t.telegram_data->'channel_post'->>'date')::bigint,
                            'chat', t.telegram_data->'channel_post'->'chat',
                            'media_group_id', t.telegram_data->'channel_post'->>'media_group_id',
                            'text', t.telegram_data->'channel_post'->>'text',
                            'caption', t.telegram_data->'channel_post'->>'caption'
                        )
                    WHEN t.telegram_data->>'edited_message' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'edited_message',
                            'message_id', (t.telegram_data->'edited_message'->>'message_id')::bigint,
                            'date', (t.telegram_data->'edited_message'->>'date')::bigint,
                            'chat', t.telegram_data->'edited_message'->'chat',
                            'from', t.telegram_data->'edited_message'->'from',
                            'media_group_id', t.telegram_data->'edited_message'->>'media_group_id',
                            'text', t.telegram_data->'edited_message'->>'text',
                            'caption', t.telegram_data->'edited_message'->>'caption',
                            'edit_date', (t.telegram_data->'edited_message'->>'edit_date')::bigint
                        )
                    WHEN t.telegram_data->>'edited_channel_post' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'edited_channel_post',
                            'message_id', (t.telegram_data->'edited_channel_post'->>'message_id')::bigint,
                            'date', (t.telegram_data->'edited_channel_post'->>'date')::bigint,
                            'chat', t.telegram_data->'edited_channel_post'->'chat',
                            'media_group_id', t.telegram_data->'edited_channel_post'->>'media_group_id',
                            'text', t.telegram_data->'edited_channel_post'->>'text',
                            'caption', t.telegram_data->'edited_channel_post'->>'caption',
                            'edit_date', (t.telegram_data->'edited_channel_post'->>'edit_date')::bigint
                        )
                    ELSE t.telegram_data
                END
            FROM to_migrate t
            WHERE m.id = t.id
            RETURNING 1
        )
        SELECT COUNT(*) INTO migrated_batch_count FROM migrated;
        
        -- Update progress counters
        total_migrated := total_migrated + migrated_batch_count;
        current_offset := current_offset + batch_size;
        has_more := migrated_batch_count > 0;
        
        -- Commit current batch to release locks
        COMMIT;
        -- Start new transaction for next batch
        BEGIN;
    END LOOP;
    
    -- Return the total count of migrated records
    RETURN QUERY SELECT total_migrated;
END;
$$;

-- 8. Trigger handle_message_update function for detecting edits
CREATE OR REPLACE FUNCTION public.handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- If caption changed, this will trigger a re-analysis
    IF NEW.caption != OLD.caption OR (NEW.caption IS NOT NULL AND OLD.caption IS NULL) THEN
        -- Store previous analyzed content in the array if it exists
        IF OLD.analyzed_content IS NOT NULL THEN
            NEW.old_analyzed_content = array_append(
                COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]),
                OLD.analyzed_content
            );
        END IF;
        
        -- Reset analysis state
        NEW.analyzed_content = NULL;
        NEW.processing_state = 'pending';
        NEW.group_caption_synced = false;
        
        -- Add to edit history
        NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
            'edit_date', CURRENT_TIMESTAMP,
            'previous_caption', OLD.caption,
            'new_caption', NEW.caption,
            'is_channel_post', NEW.chat_type = 'channel'
        );
        
        -- Log the edit
        PERFORM xdelo_logprocessingevent(
            'message_edited',
            NEW.id::text,
            COALESCE(NEW.correlation_id, gen_random_uuid()::text),
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'is_channel_post', NEW.chat_type = 'channel'
            )
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
$$;

-- 9. Trigger to check media group on message change
CREATE OR REPLACE FUNCTION public.check_media_group_on_message_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed for messages in a media group that don't have a caption
    -- and are in 'initialized' or 'pending' state
    IF NEW.media_group_id IS NOT NULL 
       AND (NEW.caption IS NULL OR NEW.caption = '')
       AND NEW.analyzed_content IS NULL
       AND NEW.processing_state IN ('initialized', 'pending') THEN
    
        -- Attempt to sync from media group
        DECLARE
            v_source_message_id uuid;
        BEGIN
            -- Find a suitable caption message
            v_source_message_id := xdelo_find_caption_message(NEW.media_group_id);
            
            IF v_source_message_id IS NOT NULL THEN
                -- Sync content from the found message
                PERFORM xdelo_sync_media_group_content(
                    v_source_message_id,
                    NEW.media_group_id,
                    COALESCE(NEW.correlation_id, gen_random_uuid()::text)
                );
            END IF;
        END;
    END IF;
  
    RETURN NEW;
END;
$$;

-- Now recreate the critical triggers
DROP TRIGGER IF EXISTS trg_check_media_group_on_message_change ON messages;
CREATE TRIGGER trg_check_media_group_on_message_change
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION check_media_group_on_message_change();

DROP TRIGGER IF EXISTS trg_handle_message_update ON messages;
CREATE TRIGGER trg_handle_message_update
AFTER UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_message_update();

-- Create or update the handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Enhance telegram metadata extraction when telegram_data is updated
CREATE OR REPLACE FUNCTION public.handle_telegram_data_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set updated_at timestamp
    NEW.updated_at = NOW();
    
    -- Only store the essential metadata when telegram_data is updated
    IF NEW.telegram_data IS DISTINCT FROM OLD.telegram_data AND NEW.telegram_data IS NOT NULL THEN
        NEW.telegram_metadata = CASE
            WHEN NEW.telegram_data->>'message' IS NOT NULL THEN 
                jsonb_build_object(
                    'message_type', 'message',
                    'message_id', (NEW.telegram_data->'message'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'message'->>'date')::bigint,
                    'chat', NEW.telegram_data->'message'->'chat',
                    'from', NEW.telegram_data->'message'->'from',
                    'media_group_id', NEW.telegram_data->'message'->>'media_group_id',
                    'text', NEW.telegram_data->'message'->>'text',
                    'caption', NEW.telegram_data->'message'->>'caption'
                )
            WHEN NEW.telegram_data->>'channel_post' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'channel_post',
                    'message_id', (NEW.telegram_data->'channel_post'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'channel_post'->>'date')::bigint,
                    'chat', NEW.telegram_data->'channel_post'->'chat',
                    'media_group_id', NEW.telegram_data->'channel_post'->>'media_group_id',
                    'text', NEW.telegram_data->'channel_post'->>'text',
                    'caption', NEW.telegram_data->'channel_post'->>'caption'
                )
            WHEN NEW.telegram_data->>'edited_message' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'edited_message',
                    'message_id', (NEW.telegram_data->'edited_message'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'edited_message'->>'date')::bigint,
                    'chat', NEW.telegram_data->'edited_message'->'chat',
                    'from', NEW.telegram_data->'edited_message'->'from',
                    'media_group_id', NEW.telegram_data->'edited_message'->>'media_group_id',
                    'text', NEW.telegram_data->'edited_message'->>'text',
                    'caption', NEW.telegram_data->'edited_message'->>'caption',
                    'edit_date', (NEW.telegram_data->'edited_message'->>'edit_date')::bigint
                )
            WHEN NEW.telegram_data->>'edited_channel_post' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'edited_channel_post',
                    'message_id', (NEW.telegram_data->'edited_channel_post'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'edited_channel_post'->>'date')::bigint,
                    'chat', NEW.telegram_data->'edited_channel_post'->'chat',
                    'media_group_id', NEW.telegram_data->'edited_channel_post'->>'media_group_id',
                    'text', NEW.telegram_data->'edited_channel_post'->>'text',
                    'caption', NEW.telegram_data->'edited_channel_post'->>'caption',
                    'edit_date', (NEW.telegram_data->'edited_channel_post'->>'edit_date')::bigint
                )
            ELSE NEW.telegram_data
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trg_handle_telegram_data_update ON messages;
CREATE TRIGGER trg_handle_telegram_data_update
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_telegram_data_update();

-- Function to extract media dimensions from telegram_data
CREATE OR REPLACE FUNCTION public.extract_media_dimensions(telegram_data jsonb)
RETURNS TABLE(width integer, height integer, duration integer)
LANGUAGE plpgsql
AS $$
BEGIN
    -- For photos (get last/largest photo from array)
    IF telegram_data ? 'photo' AND jsonb_array_length(telegram_data->'photo') > 0 THEN
        SELECT INTO width, height
            (telegram_data->'photo'->-1->>'width')::integer,
            (telegram_data->'photo'->-1->>'height')::integer;

    -- For videos
    ELSIF telegram_data ? 'video' THEN
        SELECT INTO width, height, duration
            (telegram_data->'video'->>'width')::integer,
            (telegram_data->'video'->>'height')::integer,
            (telegram_data->'video'->>'duration')::integer;

    -- For documents that might have dimensions
    ELSIF telegram_data ? 'document' THEN
        SELECT INTO width, height, duration
            (telegram_data->'document'->>'width')::integer,
            (telegram_data->'document'->>'height')::integer,
            (telegram_data->'document'->>'duration')::integer;
    END IF;

    RETURN NEXT;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_media_dimensions ON messages;
CREATE TRIGGER trg_update_media_dimensions
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_media_dimensions();

-- Set public URL function and trigger 
CREATE OR REPLACE FUNCTION public.set_public_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.storage_path IS NOT NULL AND NEW.storage_path != '' THEN
        NEW.public_url := 'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || NEW.storage_path;
        NEW.storage_path_standardized := TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_public_url ON messages;
CREATE TRIGGER set_public_url
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION set_public_url();

-- Create indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_telegram_message_chat ON messages (telegram_message_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_media_group_id ON messages (media_group_id) WHERE media_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_unique_id ON messages (file_unique_id) WHERE file_unique_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_correlation_id ON messages (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_state ON messages (processing_state);
CREATE INDEX IF NOT EXISTS idx_needs_redownload ON messages (needs_redownload) WHERE needs_redownload = true;

-- Clean up unused old functions (list of functions to drop)
DROP FUNCTION IF EXISTS public.xdelo_check_media_group_content CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_check_media_group_on_message_change CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_construct_message_url_from_data CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_extract_old_analyzed_content CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_edit CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_forward CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_sync_forward_media CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_history CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_update_message_processing_state CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_update_message_with_analyzed_content CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_update_other_message_url CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_update_other_message_url_from_data CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_repair_message_relationships CASCADE;

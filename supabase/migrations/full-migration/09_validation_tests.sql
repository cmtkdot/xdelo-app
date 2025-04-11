-- XdeloMedia Migration Validation and Testing Script
-- This script validates core functionality after migration

-- Set session variables to track validation steps and results
-- DO NOT RESET THESE UNLESS STARTING VALIDATION FROM SCRATCH
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'validation') THEN
        CREATE SCHEMA validation;
        CREATE TABLE validation.test_results (
            test_name TEXT PRIMARY KEY,
            status TEXT,
            details JSONB,
            executed_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create temp tables for test data
        CREATE TABLE IF NOT EXISTS validation.test_messages (
            id UUID PRIMARY KEY,
            telegram_message_id BIGINT,
            chat_id BIGINT,
            file_unique_id TEXT,
            media_group_id TEXT,
            caption TEXT,
            message_data JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Clear previous test data
TRUNCATE validation.test_results;
TRUNCATE validation.test_messages;

-- ============================================================
-- 1. SCHEMA VALIDATION TESTS
-- ============================================================

-- Validate required tables exist
DO $$
DECLARE
    required_tables TEXT[] := ARRAY['messages', 'other_messages', 'deleted_messages', 'unified_audit_logs'];
    missing_tables TEXT[] := '{}';
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY required_tables LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) IS NULL THEN
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('table_existence', 'PASS', jsonb_build_object(
            'message', 'All required tables exist',
            'tables_checked', required_tables
        ));
    ELSE
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('table_existence', 'FAIL', jsonb_build_object(
            'message', 'Missing required tables',
            'missing_tables', missing_tables,
            'tables_checked', required_tables
        ));
    END IF;
END $$;

-- Validate custom types exist
DO $$
DECLARE
    required_types TEXT[] := ARRAY['processing_state_type', 'audit_event_type'];
    missing_types TEXT[] := '{}';
    type_name TEXT;
BEGIN
    FOREACH type_name IN ARRAY required_types LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE n.nspname = 'public'
            AND t.typname = type_name
        ) THEN
            missing_types := array_append(missing_types, type_name);
        END IF;
    END LOOP;

    IF array_length(missing_types, 1) IS NULL THEN
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('type_existence', 'PASS', jsonb_build_object(
            'message', 'All required custom types exist',
            'types_checked', required_types
        ));
    ELSE
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('type_existence', 'FAIL', jsonb_build_object(
            'message', 'Missing required custom types',
            'missing_types', missing_types,
            'types_checked', required_types
        ));
    END IF;
END $$;

-- Validate core functions exist
DO $$
DECLARE
    required_functions TEXT[] := ARRAY[
        'upsert_media_message',
        'upsert_text_message',
        'xdelo_sync_media_group',
        'sync_media_group_captions',
        'trigger_sync_media_group_captions',
        'xdelo_process_caption_workflow',
        'xdelo_log_event'
    ];
    missing_functions TEXT[] := '{}';
    function_name TEXT;
BEGIN
    FOREACH function_name IN ARRAY required_functions LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = function_name
        ) THEN
            missing_functions := array_append(missing_functions, function_name);
        END IF;
    END LOOP;

    IF array_length(missing_functions, 1) IS NULL THEN
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('function_existence', 'PASS', jsonb_build_object(
            'message', 'All required functions exist',
            'functions_checked', required_functions
        ));
    ELSE
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('function_existence', 'FAIL', jsonb_build_object(
            'message', 'Missing required functions',
            'missing_functions', missing_functions,
            'functions_checked', required_functions
        ));
    END IF;
END $$;

-- ============================================================
-- 2. FUNCTIONAL TESTS
-- ============================================================

-- Test 1: Media Message Insert
DO $$
DECLARE
    v_message_id UUID;
    v_result JSONB;
BEGIN
    -- Generate test data
    WITH test_data AS (
        INSERT INTO validation.test_messages (
            id,
            telegram_message_id,
            chat_id,
            file_unique_id,
            media_group_id,
            caption,
            message_data
        ) VALUES (
            gen_random_uuid(),
            12345678,
            -987654321,
            'test_file_unique_id_1',
            'test_media_group_1',
            'Test caption for media group synchronization',
            '{"message_id": 12345678, "chat": {"id": -987654321, "type": "group"}, "photo": [{"file_id": "test_file_id", "file_unique_id": "test_file_unique_id_1", "width": 800, "height": 600}], "caption": "Test caption for media group synchronization"}'::jsonb
        ) RETURNING *
    )
    SELECT id, jsonb_build_object(
        'id', id,
        'telegram_message_id', telegram_message_id,
        'chat_id', chat_id,
        'file_unique_id', file_unique_id,
        'media_group_id', media_group_id,
        'caption', caption
    )
    INTO v_message_id, v_result
    FROM test_data;

    -- Now insert test message into actual messages table
    BEGIN
        SELECT upsert_media_message(
            v_message_id::text,
            12345678,
            -987654321,
            'test_file_unique_id_1',
            'test_file_id',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            'Test caption for media group synchronization',
            'test_media_group_1',
            '{"message_id": 12345678, "chat": {"id": -987654321, "type": "group"}, "photo": [{"file_id": "test_file_id", "file_unique_id": "test_file_unique_id_1", "width": 800, "height": 600}], "caption": "Test caption for media group synchronization"}'::jsonb,
            TRUE, -- is_original_caption
            NULL -- analyzed_content
        ) INTO v_message_id;
        
        -- Test passed if we get here
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('media_message_insert', 'PASS', jsonb_build_object(
            'message', 'Successfully inserted test media message',
            'message_id', v_message_id,
            'test_data', v_result
        ));
    EXCEPTION WHEN OTHERS THEN
        -- Test failed
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('media_message_insert', 'FAIL', jsonb_build_object(
            'message', 'Failed to insert test media message',
            'error', SQLERRM,
            'test_data', v_result
        ));
    END;
END $$;

-- Test 2: Media Group Synchronization
DO $$
DECLARE
    v_message_id1 UUID;
    v_message_id2 UUID;
    v_message_id3 UUID;
    v_media_group_id TEXT := 'test_media_group_sync';
    v_result JSONB;
    v_sync_result JSONB;
BEGIN
    -- Insert first message with caption (original)
    BEGIN
        SELECT upsert_media_message(
            gen_random_uuid()::text,
            12345001,
            -987654321,
            'test_file_unique_id_sync1',
            'test_file_id_sync1',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            'Test caption for synchronization',
            v_media_group_id,
            '{"message_id": 12345001}'::jsonb,
            TRUE, -- is_original_caption
            '{"parsed": "Test caption for synchronization", "analysis": "Original"}'::jsonb -- analyzed_content
        ) INTO v_message_id1;
        
        -- Insert second message without caption
        SELECT upsert_media_message(
            gen_random_uuid()::text,
            12345002,
            -987654321,
            'test_file_unique_id_sync2',
            'test_file_id_sync2',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            NULL, -- caption
            v_media_group_id,
            '{"message_id": 12345002}'::jsonb,
            FALSE, -- is_original_caption
            NULL -- analyzed_content
        ) INTO v_message_id2;
        
        -- Insert third message without caption
        SELECT upsert_media_message(
            gen_random_uuid()::text,
            12345003,
            -987654321,
            'test_file_unique_id_sync3',
            'test_file_id_sync3',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            NULL, -- caption
            v_media_group_id,
            '{"message_id": 12345003}'::jsonb,
            FALSE, -- is_original_caption
            NULL -- analyzed_content
        ) INTO v_message_id3;
        
        -- Now test media group synchronization
        SELECT xdelo_sync_media_group(
            v_message_id1, 
            v_media_group_id, 
            'test-correlation-id', 
            TRUE, -- force sync
            TRUE  -- sync edit history
        ) INTO v_sync_result;
        
        -- Check if all messages in the group have the caption and analyzed content
        WITH group_check AS (
            SELECT 
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE caption = 'Test caption for synchronization') AS caption_match_count,
                COUNT(*) FILTER (WHERE analyzed_content->>'parsed' = 'Test caption for synchronization') AS analysis_match_count,
                COUNT(*) FILTER (WHERE group_caption_synced = TRUE) AS synced_count
            FROM messages
            WHERE media_group_id = v_media_group_id
        )
        SELECT jsonb_build_object(
            'media_group_id', v_media_group_id,
            'message_ids', jsonb_build_array(v_message_id1, v_message_id2, v_message_id3),
            'total_count', total_count,
            'caption_match_count', caption_match_count,
            'analysis_match_count', analysis_match_count,
            'synced_count', synced_count,
            'sync_result', v_sync_result
        ) INTO v_result
        FROM group_check;
        
        -- Determine if test passed
        IF (v_result->>'total_count')::int = 3 AND 
           (v_result->>'caption_match_count')::int = 3 AND
           (v_result->>'analysis_match_count')::int = 3 AND
           (v_result->>'synced_count')::int = 3 THEN
            INSERT INTO validation.test_results (test_name, status, details)
            VALUES ('media_group_sync', 'PASS', v_result);
        ELSE
            INSERT INTO validation.test_results (test_name, status, details)
            VALUES ('media_group_sync', 'FAIL', jsonb_build_object(
                'message', 'Media group synchronization incomplete',
                'results', v_result
            ));
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Test failed
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('media_group_sync', 'FAIL', jsonb_build_object(
            'message', 'Error during media group synchronization test',
            'error', SQLERRM
        ));
    END;
END $$;

-- Test 3: Caption Update Propagation
DO $$
DECLARE
    v_message_id1 UUID;
    v_message_id2 UUID;
    v_media_group_id TEXT := 'test_media_group_caption_update';
    v_result JSONB;
BEGIN
    -- Insert first message with caption (original)
    BEGIN
        SELECT upsert_media_message(
            gen_random_uuid()::text,
            12346001,
            -987654321,
            'test_file_unique_id_upd1',
            'test_file_id_upd1',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            'Initial caption',
            v_media_group_id,
            '{"message_id": 12346001}'::jsonb,
            TRUE, -- is_original_caption
            '{"parsed": "Initial caption", "analysis": "Original"}'::jsonb -- analyzed_content
        ) INTO v_message_id1;
        
        -- Insert second message that should receive synced caption
        SELECT upsert_media_message(
            gen_random_uuid()::text,
            12346002,
            -987654321,
            'test_file_unique_id_upd2',
            'test_file_id_upd2',
            NULL, -- public_url
            NULL, -- storage_path
            'image/jpeg',
            'jpg',
            'photo',
            NULL, -- caption
            v_media_group_id,
            '{"message_id": 12346002}'::jsonb,
            FALSE, -- is_original_caption
            NULL -- analyzed_content
        ) INTO v_message_id2;
        
        -- Force initial sync
        PERFORM xdelo_sync_media_group(
            v_message_id1, 
            v_media_group_id, 
            'test-correlation-id-update', 
            TRUE, -- force sync
            FALSE  -- don't sync edit history yet
        );
        
        -- Now update the caption and analyzed content
        UPDATE messages
        SET 
            caption = 'Updated caption',
            analyzed_content = '{"parsed": "Updated caption", "analysis": "Modified", "version": 2}'::jsonb,
            old_analyzed_content = jsonb_build_array(analyzed_content)
        WHERE id = v_message_id1;
        
        -- The trigger should propagate this to the other message automatically
        -- Wait briefly to ensure trigger completes
        PERFORM pg_sleep(0.5);
        
        -- Check if all messages in the group have the updated caption
        WITH group_check AS (
            SELECT 
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE caption = 'Updated caption') AS caption_match_count,
                COUNT(*) FILTER (WHERE analyzed_content->>'parsed' = 'Updated caption') AS analysis_match_count,
                COUNT(*) FILTER (WHERE jsonb_array_length(old_analyzed_content) > 0) AS history_count
            FROM messages
            WHERE media_group_id = v_media_group_id
        )
        SELECT jsonb_build_object(
            'media_group_id', v_media_group_id,
            'message_ids', jsonb_build_array(v_message_id1, v_message_id2),
            'total_count', total_count,
            'caption_match_count', caption_match_count,
            'analysis_match_count', analysis_match_count,
            'history_count', history_count
        ) INTO v_result
        FROM group_check;
        
        -- Determine if test passed
        IF (v_result->>'total_count')::int = 2 AND 
           (v_result->>'caption_match_count')::int = 2 AND
           (v_result->>'analysis_match_count')::int = 2 THEN
            INSERT INTO validation.test_results (test_name, status, details)
            VALUES ('caption_update_propagation', 'PASS', v_result);
        ELSE
            INSERT INTO validation.test_results (test_name, status, details)
            VALUES ('caption_update_propagation', 'FAIL', jsonb_build_object(
                'message', 'Caption update propagation failed',
                'results', v_result
            ));
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Test failed
        INSERT INTO validation.test_results (test_name, status, details)
        VALUES ('caption_update_propagation', 'FAIL', jsonb_build_object(
            'message', 'Error during caption update propagation test',
            'error', SQLERRM
        ));
    END;
END $$;

-- ============================================================
-- 3. CLEAN UP TEST DATA
-- ============================================================

-- Delete test messages from messages table
DO $$
BEGIN
    DELETE FROM messages 
    WHERE media_group_id IN ('test_media_group_1', 'test_media_group_sync', 'test_media_group_caption_update');
    
    INSERT INTO validation.test_results (test_name, status, details)
    VALUES ('cleanup', 'PASS', jsonb_build_object(
        'message', 'Test data cleanup completed'
    ));
END $$;

-- ============================================================
-- 4. GENERATE SUMMARY REPORT
-- ============================================================

SELECT
    (SELECT COUNT(*) FROM validation.test_results) AS total_tests,
    (SELECT COUNT(*) FROM validation.test_results WHERE status = 'PASS') AS passed_tests,
    (SELECT COUNT(*) FROM validation.test_results WHERE status = 'FAIL') AS failed_tests,
    (SELECT jsonb_agg(jsonb_build_object('test_name', test_name, 'status', status, 'details', details))
     FROM validation.test_results) AS test_details;

-- Return detailed results for failures
SELECT test_name, details
FROM validation.test_results
WHERE status = 'FAIL'
ORDER BY test_name;

-- Migration: Fix action_type reference in SQL functions
-- Date: 2025-04-10
-- Description: Fix references to 'action_type' which should be 'event_type' in unified_audit_logs

-- Analyze all database functions to check for references to action_type
DO $$
DECLARE
    function_record RECORD;
    function_definition TEXT;
BEGIN
    -- Log the start of the migration
    INSERT INTO public.unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata
    ) VALUES (
        'migration_started',
        'system',
        'audit_logs_fix',
        jsonb_build_object(
            'migration_name', '20250410_fix_audit_logs_action_type',
            'description', 'Fix incorrect references to action_type in database functions'
        )
    );

    -- Look for functions that might be using action_type incorrectly
    FOR function_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) LIKE '%action_type%unified_audit_logs%'
    LOOP
        -- Log the function that needs fixing
        RAISE NOTICE 'Found function using action_type: %.%', 
            function_record.schema_name, function_record.function_name;
        
        -- Save current definition for potential rollback
        INSERT INTO public.unified_audit_logs (
            event_type,
            entity_id,
            correlation_id,
            metadata
        ) VALUES (
            'function_definition_saved',
            'function:' || function_record.function_name,
            'audit_logs_fix',
            jsonb_build_object(
                'function_name', function_record.function_name,
                'original_definition', function_record.definition
            )
        );
    END LOOP;
END $$;

-- Fix the upsert_media_message function if it's using action_type incorrectly
CREATE OR REPLACE FUNCTION public.upsert_media_message(
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_file_unique_id TEXT,
    p_file_id TEXT,
    p_storage_path TEXT,
    p_public_url TEXT,
    p_mime_type TEXT,
    p_extension TEXT,
    p_media_type TEXT,
    p_caption TEXT,
    p_processing_state TEXT,
    p_message_data JSONB,
    p_correlation_id TEXT,
    p_user_id BIGINT DEFAULT NULL,
    p_media_group_id TEXT DEFAULT NULL,
    p_forward_info JSONB DEFAULT NULL,
    p_processing_error TEXT DEFAULT NULL,
    p_caption_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_chat_type TEXT;
    v_chat_title TEXT;
    v_message_date TIMESTAMP WITH TIME ZONE;
    v_is_forward BOOLEAN;
    v_existing_message RECORD;
    v_caption_changed BOOLEAN := FALSE;
BEGIN
    -- Extract common fields from p_message_data
    v_chat_type := p_message_data->'chat'->>'type';
    v_chat_title := p_message_data->'chat'->>'title';
    v_message_date := to_timestamp((p_message_data->>'date')::BIGINT);
    v_is_forward := p_forward_info IS NOT NULL;
    
    -- First check if we already have this message by telegram_message_id and chat_id
    SELECT id, caption, analyzed_content
    INTO v_existing_message
    FROM messages
    WHERE telegram_message_id = p_telegram_message_id
    AND chat_id = p_chat_id
    LIMIT 1;
    
    IF v_existing_message.id IS NOT NULL THEN
        -- Already have this message by telegram ID, update it
        UPDATE messages
        SET 
            file_id = COALESCE(p_file_id, file_id),
            file_unique_id = COALESCE(p_file_unique_id, file_unique_id),
            storage_path = COALESCE(p_storage_path, storage_path),
            public_url = COALESCE(p_public_url, public_url),
            mime_type = COALESCE(p_mime_type, mime_type),
            extension = COALESCE(p_extension, extension),
            media_type = COALESCE(p_media_type, media_type),
            caption = COALESCE(p_caption, caption),
            processing_state = COALESCE(p_processing_state, processing_state),
            message_data = COALESCE(p_message_data, message_data),
            forward_info = COALESCE(p_forward_info, forward_info),
            is_forward = COALESCE(v_is_forward, is_forward),
            correlation_id = COALESCE(p_correlation_id, correlation_id),
            processing_error = COALESCE(p_processing_error, processing_error),
            caption_data = COALESCE(p_caption_data, caption_data),
            updated_at = NOW()
        WHERE id = v_existing_message.id
        RETURNING id INTO v_message_id;
        
        -- Log the message update
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            correlation_id,
            metadata
        ) VALUES (
            'message_updated',
            v_message_id,
            p_correlation_id,
            jsonb_build_object(
                'message_id', p_telegram_message_id,
                'chat_id', p_chat_id,
                'file_unique_id', p_file_unique_id
            )
        );
    ELSE
        -- Check if we have a message with the same file_unique_id (important for duplicate detection)
        SELECT id, caption, analyzed_content
        INTO v_existing_message
        FROM messages
        WHERE file_unique_id = p_file_unique_id
        LIMIT 1;
        
        IF v_existing_message.id IS NOT NULL THEN
            -- Check if caption has changed
            IF p_caption IS NOT NULL AND v_existing_message.caption IS NOT NULL AND 
               p_caption != v_existing_message.caption THEN
                v_caption_changed := TRUE;
            END IF;
            
            -- Special handling for duplicates: preserve history when caption changes
            UPDATE messages
            SET 
                telegram_message_id = p_telegram_message_id,
                chat_id = p_chat_id,
                chat_type = v_chat_type,
                chat_title = v_chat_title,
                file_id = COALESCE(p_file_id, file_id),
                storage_path = COALESCE(p_storage_path, storage_path),
                public_url = COALESCE(p_public_url, public_url),
                mime_type = COALESCE(p_mime_type, mime_type),
                extension = COALESCE(p_extension, extension),
                media_type = COALESCE(p_media_type, media_type),
                caption = CASE WHEN v_caption_changed THEN p_caption ELSE COALESCE(p_caption, caption) END,
                message_data = COALESCE(p_message_data, message_data),
                message_date = COALESCE(v_message_date::DATE, message_date),
                forward_info = COALESCE(p_forward_info, forward_info),
                is_forward = COALESCE(v_is_forward, is_forward),
                correlation_id = COALESCE(p_correlation_id, correlation_id),
                media_group_id = COALESCE(p_media_group_id, media_group_id),
                processing_error = COALESCE(p_processing_error, processing_error),
                caption_data = CASE 
                    WHEN v_caption_changed THEN p_caption_data 
                    ELSE COALESCE(p_caption_data, caption_data) 
                END,
                -- Special handling for caption changes: move current analyzed_content to history
                old_analyzed_content = CASE 
                    WHEN v_caption_changed AND v_existing_message.analyzed_content IS NOT NULL THEN
                        COALESCE(
                            old_analyzed_content || jsonb_build_array(v_existing_message.analyzed_content),
                            jsonb_build_array(v_existing_message.analyzed_content)
                        )
                    ELSE old_analyzed_content
                END,
                -- Reset processing state when caption changes to trigger reprocessing
                processing_state = CASE 
                    WHEN v_caption_changed THEN 'initialized'
                    ELSE COALESCE(p_processing_state, processing_state) 
                END,
                updated_at = NOW()
            WHERE id = v_existing_message.id
            RETURNING id INTO v_message_id;
            
            -- Log the duplicate with caption change
            INSERT INTO unified_audit_logs (
                event_type,
                entity_id,
                correlation_id,
                metadata
            ) VALUES (
                CASE WHEN v_caption_changed 
                    THEN 'duplicate_message_caption_changed' 
                    ELSE 'duplicate_message_updated' 
                END,
                v_message_id,
                p_correlation_id,
                jsonb_build_object(
                    'message_id', p_telegram_message_id,
                    'chat_id', p_chat_id,
                    'file_unique_id', p_file_unique_id,
                    'caption_changed', v_caption_changed
                )
            );
        ELSE
            -- New message, insert it
            INSERT INTO messages (
                telegram_message_id,
                chat_id,
                chat_type,
                chat_title,
                file_id,
                file_unique_id,
                storage_path,
                public_url,
                mime_type,
                extension,
                media_type,
                caption,
                processing_state,
                message_data,
                message_date,
                forward_info,
                is_forward,
                correlation_id,
                media_group_id,
                processing_error,
                caption_data
            ) VALUES (
                p_telegram_message_id,
                p_chat_id,
                v_chat_type,
                v_chat_title,
                p_file_id,
                p_file_unique_id,
                p_storage_path,
                p_public_url,
                p_mime_type,
                p_extension,
                p_media_type,
                p_caption,
                p_processing_state,
                p_message_data,
                v_message_date::DATE,
                p_forward_info,
                v_is_forward,
                p_correlation_id,
                p_media_group_id,
                p_processing_error,
                p_caption_data
            )
            RETURNING id INTO v_message_id;
            
            -- Log the new message
            INSERT INTO unified_audit_logs (
                event_type,
                entity_id,
                correlation_id,
                metadata
            ) VALUES (
                'message_created',
                v_message_id,
                p_correlation_id,
                jsonb_build_object(
                    'message_id', p_telegram_message_id,
                    'chat_id', p_chat_id,
                    'file_unique_id', p_file_unique_id,
                    'media_type', p_media_type
                )
            );
        END IF;
    END IF;
    
    RETURN v_message_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            correlation_id,
            metadata,
            error_message
        ) VALUES (
            'message_upsert_error',
            COALESCE(v_message_id, gen_random_uuid()),
            p_correlation_id,
            jsonb_build_object(
                'message_id', p_telegram_message_id,
                'chat_id', p_chat_id,
                'file_unique_id', p_file_unique_id
            ),
            SQLERRM
        );
        RAISE;
END $$;

-- Log the completion of the migration
INSERT INTO public.unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
) VALUES (
    'migration_completed',
    'system',
    'audit_logs_fix',
    jsonb_build_object(
        'migration_name', '20250410_fix_audit_logs_action_type',
        'description', 'Fixed incorrect references to action_type in database functions',
        'completed_at', NOW()
    )
);

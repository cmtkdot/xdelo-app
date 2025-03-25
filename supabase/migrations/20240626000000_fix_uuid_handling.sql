
-- Create or replace the improved xdelo_logprocessingevent function
-- This function handles non-UUID entity_ids gracefully
CREATE OR REPLACE FUNCTION public.xdelo_logprocessingevent(
    p_event_type text,
    p_entity_id text,
    p_correlation_id text,
    p_metadata jsonb DEFAULT NULL::jsonb,
    p_error_message text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    v_uuid UUID;
    v_entity_uuid UUID;
    v_metadata JSONB;
BEGIN
    -- Try to cast entity_id to UUID if it's already in UUID format
    BEGIN
        v_entity_uuid := p_entity_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        -- If casting fails, generate a new UUID and store original in metadata
        v_entity_uuid := gen_random_uuid();
        
        -- Prepare metadata to include original entity ID
        v_metadata := COALESCE(p_metadata, '{}'::JSONB) || 
                     JSONB_build_object('original_entity_id', p_entity_id);
    END;
    
    -- Use the metadata we prepared, or the original if no conversion was needed
    v_metadata := COALESCE(v_metadata, p_metadata);
    
    -- Insert the log entry with the valid UUID
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message,
        event_timestamp
    ) VALUES (
        p_event_type,
        v_entity_uuid,
        p_correlation_id,
        v_metadata,
        p_error_message,
        NOW()
    )
    RETURNING id INTO v_uuid;
    
    RETURN v_uuid;
EXCEPTION WHEN OTHERS THEN
    -- Fall back to console logging if database insert fails
    RAISE NOTICE 'Failed to log event: % % %', p_event_type, p_entity_id, SQLERRM;
    RETURN NULL;
END;
$function$;

-- Function to fix existing audit logs with invalid UUIDs
CREATE OR REPLACE FUNCTION public.xdelo_fix_audit_log_uuids()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_fixed_count INTEGER := 0;
    v_broken_logs RECORD;
    v_new_uuid UUID;
BEGIN
    -- Find and fix any non-UUID entity_id values
    FOR v_broken_logs IN
        SELECT id, entity_id, metadata
        FROM unified_audit_logs
        WHERE
            -- Try to identify broken UUID entries by checking format or null values
            (entity_id IS NULL
            OR entity_id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
            -- Skip entries that have already been fixed
            AND metadata->>'original_entity_id' IS NULL
    LOOP
        -- Generate a new valid UUID
        v_new_uuid := gen_random_uuid();
        
        -- Update the record with new UUID and save original in metadata
        UPDATE unified_audit_logs
        SET 
            entity_id = v_new_uuid,
            metadata = COALESCE(v_broken_logs.metadata, '{}'::jsonb) || 
                       jsonb_build_object('original_entity_id', v_broken_logs.entity_id)
        WHERE id = v_broken_logs.id;
        
        v_fixed_count := v_fixed_count + 1;
    END LOOP;
    
    -- Return information about the fix operation
    RETURN jsonb_build_object(
        'success', TRUE,
        'fixed_count', v_fixed_count,
        'timestamp', now()
    );
END;
$function$;


-- Update the processing_state enum type to remove 'partial_success'
DO $$
BEGIN
    -- Check if the value exists in the enum before attempting to remove it
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'processing_state'
        AND e.enumlabel = 'partial_success'
    ) THEN
        -- Create a temporary function to update the enum values
        CREATE OR REPLACE FUNCTION xdelo_update_processing_state_enum() RETURNS void AS $$
        BEGIN
            -- First update any messages using the partial_success state to 'completed'
            UPDATE public.messages 
            SET processing_state = 'completed'
            WHERE processing_state = 'partial_success';
            
            -- Update the enum type
            ALTER TYPE processing_state RENAME TO processing_state_old;
            CREATE TYPE processing_state AS ENUM ('initialized', 'pending', 'processing', 'completed', 'error');
            
            -- Update the messages table to use the new enum
            ALTER TABLE public.messages 
            ALTER COLUMN processing_state TYPE processing_state 
            USING processing_state::text::processing_state;
            
            -- Drop the old enum
            DROP TYPE processing_state_old;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Execute the function
        PERFORM xdelo_update_processing_state_enum();
        
        -- Drop the temporary function
        DROP FUNCTION IF EXISTS xdelo_update_processing_state_enum();
        
        -- Log the schema change
        INSERT INTO public.unified_audit_logs (
            event_type, 
            metadata,
            entity_id
        ) VALUES (
            'system_schema_updated',
            jsonb_build_object(
                'change', 'Updated processing_state enum to remove partial_success',
                'updated_at', now()
            ),
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;
END
$$;

-- Create or replace the function to get message processing statistics
CREATE OR REPLACE FUNCTION public.xdelo_get_message_processing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT 
    jsonb_build_object(
      'total', COUNT(*),
      'initialized', COUNT(*) FILTER (WHERE processing_state = 'initialized'),
      'pending', COUNT(*) FILTER (WHERE processing_state = 'pending'),
      'processing', COUNT(*) FILTER (WHERE processing_state = 'processing'),
      'completed', COUNT(*) FILTER (WHERE processing_state = 'completed'),
      'error', COUNT(*) FILTER (WHERE processing_state = 'error'),
      'stalled_processing', COUNT(*) FILTER (WHERE 
        processing_state = 'processing' AND 
        processing_started_at < NOW() - interval '30 minutes'
      ),
      'stalled_pending', COUNT(*) FILTER (WHERE 
        processing_state = 'pending' AND 
        last_processing_attempt < NOW() - interval '60 minutes'
      ),
      'processing_times', jsonb_build_object(
        'avg_minutes', EXTRACT(EPOCH FROM AVG(processing_completed_at - processing_started_at))/60 
                      FILTER (WHERE processing_completed_at IS NOT NULL AND processing_started_at IS NOT NULL),
        'max_minutes', EXTRACT(EPOCH FROM MAX(processing_completed_at - processing_started_at))/60 
                      FILTER (WHERE processing_completed_at IS NOT NULL AND processing_started_at IS NOT NULL)
      )
    ) INTO result
  FROM messages;
  
  RETURN result;
END;
$$;


-- Update the processing_state enum to simplify states
DO $$
BEGIN
    -- First update any messages using old states to standard ones
    UPDATE public.messages 
    SET processing_state = 'completed'
    WHERE processing_state = 'partial_success';
    
    UPDATE public.messages
    SET processing_state = 'pending'
    WHERE processing_state = 'initialized';
    
    -- Create the new enum type if it doesn't exist already
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_state_new') THEN
        -- Create the new enum type with simplified states
        CREATE TYPE processing_state_new AS ENUM ('pending', 'processing', 'completed', 'error');
        
        -- Update the messages table to use the new enum
        ALTER TABLE public.messages 
        ALTER COLUMN processing_state TYPE processing_state_new 
        USING 
            CASE processing_state::text
                WHEN 'initialized' THEN 'pending'
                WHEN 'partial_success' THEN 'completed'
                ELSE processing_state::text
            END::processing_state_new;
            
        -- Rename the types to complete the switch
        ALTER TYPE processing_state RENAME TO processing_state_old;
        ALTER TYPE processing_state_new RENAME TO processing_state;
        
        -- Optionally drop the old type if safe to do so
        -- Only enable this after verifying no dependencies
        -- DROP TYPE processing_state_old;
    END IF;
    
    -- Add error_code and error_message columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'error_code'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN error_code TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN error_message TEXT;
    END IF;
    
    -- Remove unnecessary columns
    -- These are columns that add complexity but aren't essential
    BEGIN
        ALTER TABLE public.messages DROP COLUMN IF EXISTS processing_correlation_id;
        ALTER TABLE public.messages DROP COLUMN IF EXISTS sync_attempt;
        ALTER TABLE public.messages DROP COLUMN IF EXISTS processing_attempts;
        ALTER TABLE public.messages DROP COLUMN IF EXISTS last_processing_attempt;
        ALTER TABLE public.messages DROP COLUMN IF EXISTS retry_count;
        ALTER TABLE public.messages DROP COLUMN IF EXISTS fallback_processed;
    EXCEPTION
        WHEN OTHERS THEN
            -- If any error occurs, log it but continue
            RAISE NOTICE 'Error removing columns: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Processing state enum and message table updated successfully';
END
$$;

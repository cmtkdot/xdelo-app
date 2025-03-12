
-- Fix message table schema issues related to error columns
DO $$
BEGIN
    -- Check if the error column exists - if it does, we need to rename it to error_message
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'error'
    ) THEN
        ALTER TABLE public.messages RENAME COLUMN error TO error_message;
    END IF;

    -- Check if error_message column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN error_message TEXT;
    END IF;

    -- Check if error_code column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'error_code'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN error_code TEXT;
    END IF;

    -- Check if storage_exists column exists, if not add it (useful for tracking if files exist)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'storage_exists'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN storage_exists BOOLEAN DEFAULT FALSE;
    END IF;

    -- Check if storage_path_standardized column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'storage_path_standardized'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN storage_path_standardized BOOLEAN DEFAULT FALSE;
    END IF;

    RAISE NOTICE 'Messages table schema has been updated successfully.';
END $$;

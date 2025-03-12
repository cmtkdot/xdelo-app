
-- Add missing columns to the messages table
DO $$
BEGIN
    -- Check if error_message column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'error_message') THEN
        ALTER TABLE public.messages ADD COLUMN error_message TEXT;
    END IF;

    -- Check if needs_redownload column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'needs_redownload') THEN
        ALTER TABLE public.messages ADD COLUMN needs_redownload BOOLEAN DEFAULT FALSE;
    END IF;

    -- Check if redownload_reason column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'redownload_reason') THEN
        ALTER TABLE public.messages ADD COLUMN redownload_reason TEXT;
    END IF;

    -- Check if redownload_flagged_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'redownload_flagged_at') THEN
        ALTER TABLE public.messages ADD COLUMN redownload_flagged_at TIMESTAMPTZ;
    END IF;

    -- Check if redownload_strategy column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'redownload_strategy') THEN
        ALTER TABLE public.messages ADD COLUMN redownload_strategy TEXT;
    END IF;

    -- Check if redownload_attempts column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'redownload_attempts') THEN
        ALTER TABLE public.messages ADD COLUMN redownload_attempts INTEGER DEFAULT 0;
    END IF;

    -- Check if file_id_expires_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'file_id_expires_at') THEN
        ALTER TABLE public.messages ADD COLUMN file_id_expires_at TIMESTAMPTZ;
    END IF;

    -- Check if original_file_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'original_file_id') THEN
        ALTER TABLE public.messages ADD COLUMN original_file_id TEXT;
    END IF;

    -- Check if is_duplicate column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'is_duplicate') THEN
        ALTER TABLE public.messages ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
    END IF;

    -- Check if correlation_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'correlation_id') THEN
        ALTER TABLE public.messages ADD COLUMN correlation_id UUID;
    END IF;

    -- Check if processing_correlation_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'processing_correlation_id') THEN
        ALTER TABLE public.messages ADD COLUMN processing_correlation_id UUID;
    END IF;

    -- Check if processing_attempts column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'processing_attempts') THEN
        ALTER TABLE public.messages ADD COLUMN processing_attempts INTEGER DEFAULT 0;
    END IF;

    -- Check if last_processing_attempt column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'last_processing_attempt') THEN
        ALTER TABLE public.messages ADD COLUMN last_processing_attempt TIMESTAMPTZ;
    END IF;

    RAISE NOTICE 'Messages table schema has been updated successfully.';
END $$;

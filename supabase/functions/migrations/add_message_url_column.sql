
-- Add message_url column to other_messages if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'other_messages' 
        AND column_name = 'message_url'
    ) THEN
        ALTER TABLE public.other_messages ADD COLUMN message_url TEXT;
    END IF;
END $$;

-- Update existing rows to add message_url where possible
UPDATE public.other_messages
SET message_url = 
    CASE
        WHEN chat_id < 0 THEN
            CASE 
                WHEN chat_id < -100000000000 THEN
                    'https://t.me/c/' || SUBSTRING(ABS(chat_id)::text, 4) || '/' || telegram_message_id
                ELSE
                    'https://t.me/c/' || ABS(chat_id)::text || '/' || telegram_message_id
            END
        ELSE NULL
    END
WHERE message_url IS NULL
AND telegram_message_id IS NOT NULL
AND chat_id < 0;

-- Fix unified_audit_logs table to ensure entity_id is not null
-- For system errors, use a generated UUID instead of 'system'
UPDATE public.unified_audit_logs
SET entity_id = gen_random_uuid()
WHERE entity_id IS NULL;

-- Add not null constraint if it doesn't already exist
ALTER TABLE public.unified_audit_logs 
ALTER COLUMN entity_id SET NOT NULL;

-- Remove deprecated database function if it exists
DROP FUNCTION IF EXISTS xdelo_construct_telegram_message_url;


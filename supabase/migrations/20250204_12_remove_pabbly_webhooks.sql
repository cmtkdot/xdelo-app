-- Drop all Pabbly webhook triggers from message tables
DO $$ 
DECLARE 
    table_name text;
BEGIN
    -- Drop webhooks from main messages table
    DROP TRIGGER IF EXISTS custom_pabbly_webhook_on_all_events ON messages;
    
    -- Drop webhooks from partitioned tables
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'messages_2025_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS custom_pabbly_webhook_on_all_events ON %I', table_name);
    END LOOP;
END $$;

-- Remove webhook configurations
DELETE FROM supabase_functions.hooks 
WHERE hook_table_id IN (
    SELECT id 
    FROM supabase_functions.hooks_tables 
    WHERE table_name LIKE 'messages%'
) 
AND hook_type = 'custom-pabbly-webhook-on-all-events';

-- Remove hook table configurations
DELETE FROM supabase_functions.hooks_tables 
WHERE table_name LIKE 'messages%';

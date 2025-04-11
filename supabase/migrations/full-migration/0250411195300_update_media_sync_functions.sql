-- Drop legacy functions and triggers if they exist
DROP FUNCTION IF EXISTS sync_analyzed_content() CASCADE;
DROP FUNCTION IF EXISTS sync_pending_media_groups() CASCADE;

-- Create the new x_sync_pending_media_groups function
CREATE OR REPLACE FUNCTION x_sync_pending_media_groups()
RETURNS INTEGER AS $$
DECLARE
    mg TEXT;
    caption_msg RECORD;
    updated_count INTEGER := 0;
    update_result INTEGER;
BEGIN
    -- Find media groups with potential caption messages that haven't been synced
    FOR mg IN 
        SELECT DISTINCT m.media_group_id
        FROM messages m
        WHERE 
            m.media_group_id IS NOT NULL
            AND m.caption IS NOT NULL
            AND m.caption <> ''
            AND EXISTS (
                -- Check if there are other messages in the group without this caption
                SELECT 1
                FROM messages m2
                WHERE 
                    m2.media_group_id = m.media_group_id
                    AND (m2.caption IS NULL OR m2.caption <> m.caption)
            )
    LOOP
        -- Find the caption message for this media group
        SELECT * INTO caption_msg
        FROM messages
        WHERE 
            media_group_id = mg
            AND caption IS NOT NULL
            AND caption <> ''
        ORDER BY 
            created_at ASC
        LIMIT 1;
        
        IF caption_msg.id IS NOT NULL THEN
            -- Update all messages in this media group with the caption
            UPDATE messages
            SET 
                caption = caption_msg.caption,
                analyzed_content = caption_msg.analyzed_content,
                message_caption_id = caption_msg.id
            WHERE 
                media_group_id = mg
                AND id <> caption_msg.id
                AND (
                    caption IS NULL
                    OR caption <> caption_msg.caption
                    OR message_caption_id IS NULL
                    OR message_caption_id <> caption_msg.id
                );
                
            GET DIAGNOSTICS update_result = ROW_COUNT;
            updated_count := updated_count + update_result;
            
            IF update_result > 0 THEN
                RAISE NOTICE 'Synced % messages in media group %', update_result, mg;
            END IF;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION x_sync_pending_media_groups() TO postgres, anon, authenticated, service_role;

-- Create cron job to run x_sync_pending_media_groups every 5 minutes
SELECT cron.schedule(
    'sync-media-groups-every-5-minutes',
    '*/5 * * * *',
    $$SELECT x_sync_pending_media_groups()$$
);

-- Ensure the schedule is active
UPDATE cron.job 
SET active = true 
WHERE jobname = 'sync-media-groups-every-5-minutes';
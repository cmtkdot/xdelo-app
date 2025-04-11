Telegram Media Group Synchronization Documentation
Overview
This document describes the synchronization mechanism for Telegram media groups, particularly how captions, analyzed content, and message relationships are maintained across all messages within a media group.

Core Components
1. Database Trigger: sync_analyzed_content
sql
CopyInsert
CREATE TRIGGER sync_analyzed_content_trigger
AFTER UPDATE OF analyzed_content, message_data, message_caption_id ON messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL)
EXECUTE FUNCTION sync_analyzed_content();
This trigger is activated when any message with a media_group_id is updated, specifically when changes are made to analyzed_content, message_data, or message_caption_id. The trigger then propagates these changes to all other messages in the same media group.

2. Scheduled Function: sync_pending_media_groups
sql
CopyInsert
-- Create a scheduled job to run this function every 5 minutes
SELECT cron.schedule(
  'sync_media_groups_job',
  '*/5 * * * *',
  'SELECT sync_pending_media_groups()'
);
This scheduled function ensures that media groups are properly synchronized even when messages arrive out of order (e.g., when a caption-containing message arrives after other media).

Synchronization Logic
Message Relationships
Caption Source Identification
Messages with captions are identified and marked as is_original_caption = TRUE
These messages are assigned message_caption_id = their own id (self-reference)
All other messages in the same media group reference the caption message via message_caption_id
Content Synchronization
When a message is updated:

The sync_analyzed_content trigger fires
Updates all other messages in the media group with:
analyzed_content from the updated message
old_analyzed_content history (preserving previous content)
message_data for additional metadata
message_caption_id for proper relationship tracking
processing_state = 'completed' to indicate synchronization
group_caption_synced = TRUE to mark as synchronized
last_synced_at = NOW() for audit purposes
Delayed Synchronization
The sync_pending_media_groups function handles cases where messages arrive out of order:

Identifies media groups older than 30 seconds with unsynchronized messages
Finds the best reference message with caption in each group
Ensures the reference message has message_caption_id set properly
Updates the reference message to trigger the synchronization cascade
Database Schema Requirements
The messages table requires these fields for proper synchronization:

sql
CopyInsert
-- Required fields for caption relationships
message_caption_id UUID NULL REFERENCES messages(id) ON DELETE CASCADE,
is_original_caption BOOLEAN NULL DEFAULT false,
group_caption_synced BOOLEAN NULL DEFAULT false,

-- Fields for content tracking
analyzed_content JSONB NULL,
old_analyzed_content JSONB NULL, 
message_data JSONB NULL,

-- Fields for synchronization tracking
processing_state processing_state_type NOT NULL DEFAULT 'initialized',
last_synced_at TIMESTAMPTZ NULL,
Implementation Details
Trigger Function Logic
sql
CopyInsert
CREATE OR REPLACE FUNCTION sync_analyzed_content()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.media_group_id IS NOT NULL AND NEW.analyzed_content IS NOT NULL THEN
        UPDATE messages
        SET 
            analyzed_content = NEW.analyzed_content,
            old_analyzed_content = CASE
                WHEN NEW.old_analyzed_content IS NOT NULL THEN NEW.old_analyzed_content
                ELSE COALESCE(old_analyzed_content, '[]'::jsonb)
            END,
            message_data = CASE
                WHEN NEW.message_data IS NOT NULL THEN NEW.message_data
                ELSE message_data
            END,
            message_caption_id = CASE
                WHEN NEW.message_caption_id IS NOT NULL THEN NEW.message_caption_id
                ELSE message_caption_id
            END,
            processing_state = 'completed',
            group_caption_synced = TRUE,
            last_synced_at = NOW(),
            updated_at = NOW()
        WHERE 
            media_group_id = NEW.media_group_id
            AND id <> NEW.id  -- Exclude the triggering message
            AND (
                analyzed_content IS NULL OR 
                analyzed_content <> NEW.analyzed_content OR
                (NEW.message_caption_id IS NOT NULL AND 
                 (message_caption_id IS NULL OR message_caption_id <> NEW.message_caption_id)) OR
                processing_state <> 'completed' OR
                group_caption_synced IS NOT TRUE
            );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
Scheduled Function Logic
sql
CopyInsert
CREATE OR REPLACE FUNCTION sync_pending_media_groups()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
  mg RECORD;
  ref_msg RECORD;
BEGIN
  -- Find media groups with potential caption messages that haven't been synced
  FOR mg IN 
    SELECT DISTINCT m.media_group_id
    FROM messages m
    WHERE 
      m.media_group_id IS NOT NULL
      AND m.caption IS NOT NULL
      AND m.created_at < (NOW() - INTERVAL '30 seconds')
      AND EXISTS (
        SELECT 1 FROM messages m2 
        WHERE 
          m2.media_group_id = m.media_group_id
          AND (
            m2.group_caption_synced IS NOT TRUE OR
            m2.group_caption_synced IS NULL OR
            m2.message_caption_id IS NULL
          )
      )
    LIMIT 50  -- Process in batches
  LOOP
    -- Find the reference message with caption for this media group
    SELECT * INTO ref_msg
    FROM messages
    WHERE 
      media_group_id = mg.media_group_id
      AND caption IS NOT NULL
    ORDER BY 
      CASE WHEN analyzed_content IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN is_original_caption = TRUE THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 1;
    
    -- Only proceed if we found a reference message
    IF ref_msg.id IS NOT NULL THEN
      -- First, ensure the reference message has self-reference if needed
      IF ref_msg.message_caption_id IS NULL THEN
        UPDATE messages 
        SET 
          message_caption_id = id,
          updated_at = NOW()
        WHERE id = ref_msg.id;
      END IF;
      
      -- Then, update the reference message to trigger sync for other messages
      UPDATE messages
      SET 
        updated_at = NOW(),
        is_original_caption = TRUE,
        group_caption_synced = TRUE
      WHERE id = ref_msg.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
Smart Dispatcher Integration
This synchronization system complements the Smart Dispatcher Pattern, where:

All messages flow through a unified handleMediaMessage function
Proper relationship tracking ensures caption changes propagate correctly
Message history is preserved through old_analyzed_content as a JSONB array
Processing states are consistently maintained across all messages in a group
Performance Considerations
The trigger uses conditional updates to minimize unnecessary database operations
The scheduled function processes in batches (50 at a time) to manage workload
Messages are only processed after a 30-second delay to ensure all group messages have arrived
Appropriate indexes on media_group_id, group_caption_synced, and message_caption_id improve query performance
Testing and Monitoring
To verify synchronization is working properly:

Check that message_caption_id values within a media group all point to the message with a caption
Confirm group_caption_synced = TRUE for all messages in synchronized groups
Verify that analyzed_content is consistent across all messages in a media group
Monitor the last_synced_at field to track when synchronizations occur
This synchronization system ensures caption relationships and analyzed content remain consistent across media groups, even when messages arrive out of order or when captions are edited.


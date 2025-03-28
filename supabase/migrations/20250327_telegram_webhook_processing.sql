-- Transaction Helper Functions (continued)
CREATE OR REPLACE FUNCTION public.rollback_transaction() RETURNS JSONB AS $$
BEGIN
  -- Rollback the transaction
  ROLLBACK;
  RETURN jsonb_build_object('success', TRUE, 'message', 'Transaction rolled back');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron Setup Functions
CREATE OR REPLACE FUNCTION public.setup_media_group_recheck_cron() RETURNS TEXT AS $$
BEGIN
  SELECT cron.schedule(
    'recheck-media-groups-every-minute',
    '* * * * *',  -- Run every minute
    'SELECT xdelo_recheck_media_groups()'
  );

  RETURN 'Media group recheck cron job scheduled successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.setup_stalled_messages_reset_cron() RETURNS TEXT AS $$
BEGIN
  SELECT cron.schedule(
    'reset-stalled-messages-every-5-minutes',
    '*/5 * * * *',  -- Run every 5 minutes
    'SELECT xdelo_reset_stalled_messages(15)'
  );

  RETURN 'Stalled message reset cron job scheduled successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE OR REPLACE FUNCTION public.trigger_caption_processing() RETURNS TRIGGER AS $$
BEGIN
  -- Only act when caption is added or changed
  IF (TG_OP = 'INSERT' AND NEW.caption IS NOT NULL AND NEW.caption <> '') OR
     (TG_OP = 'UPDATE' AND
      (OLD.caption IS NULL OR OLD.caption <> NEW.caption) AND
      NEW.caption IS NOT NULL AND NEW.caption <> '') THEN

    -- For edited messages, preserve history
    IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content = OLD.analyzed_content;
      NEW.is_edited = TRUE;
    END IF;

    -- Set to pending for processing
    NEW.processing_state = 'pending';
    NEW.processing_started_at = NOW();
    NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'update_type', TG_OP,
      'trigger_time', NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_process_caption ON messages;
CREATE TRIGGER trigger_process_caption
BEFORE INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption <> '')
EXECUTE FUNCTION trigger_caption_processing();

-- Analyzed Content Processing Trigger
CREATE OR REPLACE FUNCTION public.trigger_analyzed_content_processing() RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if analyzed_content has been updated and is not null
  IF NEW.analyzed_content IS NOT NULL AND
     (OLD.analyzed_content IS NULL OR OLD.analyzed_content <> NEW.analyzed_content) THEN

    -- Extract fields to dedicated columns (optional)
    NEW.product_name = NEW.analyzed_content->>'productName';
    NEW.product_code = NEW.analyzed_content->>'productCode';
    NEW.vendor_uid = NEW.analyzed_content->>'vendorUID';
    NEW.purchase_date = (NEW.analyzed_content->>'purchaseDate')::date;
    NEW.quantity = (NEW.analyzed_content->>'quantity')::int;
    NEW.notes = NEW.analyzed_content->>'notes';

    -- Set processing state to completed
    NEW.processing_state = 'completed';
    NEW.processing_completed_at = NOW();

    -- Media group sync will be handled by a separate trigger
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_process_analyzed_content ON messages;
CREATE TRIGGER trigger_process_analyzed_content
BEFORE UPDATE OF analyzed_content ON messages
FOR EACH ROW
EXECUTE FUNCTION trigger_analyzed_content_processing();

-- Media Group Sync Trigger
CREATE OR REPLACE FUNCTION public.trigger_media_group_sync() RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if analyzed_content has been updated and is part of media group
  IF NEW.analyzed_content IS NOT NULL AND
     (OLD.analyzed_content IS NULL OR OLD.analyzed_content <> NEW.analyzed_content) AND
     NEW.media_group_id IS NOT NULL AND
     NEW.processing_state = 'completed' THEN

    -- Perform media group sync in a background task
    PERFORM pg_notify(
      'media_group_sync',
      json_build_object(
        'message_id', NEW.id,
        'media_group_id', NEW.media_group_id,
        'correlation_id', (NEW.metadata->>'correlation_id')
      )::text
    );

    -- Mark as original caption for the group
    NEW.is_original_caption = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_sync_media_group ON messages;
CREATE TRIGGER trigger_sync_media_group
AFTER UPDATE OF analyzed_content ON messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL)
EXECUTE FUNCTION trigger_media_group_sync();

-- Monitoring Views
CREATE OR REPLACE VIEW public.v_message_processing_stats AS
SELECT
  processing_state,
  COUNT(*) as message_count,
  MIN(processing_started_at) as oldest_started,
  MAX(processing_started_at) as newest_started,
  COUNT(*) FILTER (WHERE media_group_id IS NOT NULL) as in_media_group,
  COUNT(*) FILTER (WHERE caption IS NOT NULL) as with_caption,
  COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) as with_analyzed_content,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as with_errors
FROM messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY processing_state;

CREATE OR REPLACE VIEW public.v_media_group_consistency AS
SELECT
  media_group_id,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) as with_content,
  COUNT(*) FILTER (WHERE analyzed_content IS NULL) as without_content,
  MIN(created_at) as oldest_message,
  MAX(created_at) as newest_message,
  CASE
    WHEN COUNT(*) FILTER (WHERE analyzed_content IS NULL) > 0
     AND COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) > 0
    THEN 'inconsistent'
    WHEN COUNT(*) FILTER (WHERE analyzed_content IS NULL) = COUNT(*)
    THEN 'no_content'
    ELSE 'consistent'
  END as status
FROM messages
WHERE
  media_group_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY media_group_id
ORDER BY newest_message DESC;

-- Setup cron jobs
SELECT setup_media_group_recheck_cron();
SELECT setup_stalled_messages_reset_cron();

COMMIT;

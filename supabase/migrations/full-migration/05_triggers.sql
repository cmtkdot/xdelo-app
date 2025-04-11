-- XdeloMedia Triggers and Trigger Functions Migration
-- This script creates all the trigger functions and actual triggers

-- Trigger function to prevent unnecessary message updates
CREATE OR REPLACE FUNCTION public.prevent_unnecessary_message_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _changes_detected boolean := false;
  _significant_fields text[] := ARRAY[
    'caption', 
    'analyzed_content', 
    'processing_state', 
    'media_group_id', 
    'product_name', 
    'product_sku',
    'product_price',
    'product_quantity',
    'purchase_date',
    'store_name',
    'product_category',
    'product_url'
  ];
  _field text;
BEGIN
  -- Skip if the message is being updated with an edit from Telegram
  IF NEW.is_edit = true THEN
    RETURN NEW;
  END IF;

  -- If message is in a transitional processing state, allow updates
  IF NEW.processing_state IN ('processing', 'pending', 'initialized') THEN
    RETURN NEW;
  END IF;
  
  -- Check if any significant fields are changed
  FOREACH _field IN ARRAY _significant_fields
  LOOP
    EXECUTE format('SELECT $1.%I IS DISTINCT FROM $2.%I', _field, _field)
    INTO _changes_detected
    USING NEW, OLD;
    
    IF _changes_detected THEN
      RETURN NEW;  -- Allow the update
    END IF;
  END LOOP;
  
  -- If trigger_source is explicitly set, allow the update
  IF NEW.trigger_source IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- If no significant changes detected, reject the update
  RETURN OLD;
END;
$$;

-- Trigger function to sync caption fields
CREATE OR REPLACE FUNCTION public.sync_caption_fields_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- When caption_data is updated but analyzed_content is not
    IF (NEW.caption_data IS DISTINCT FROM OLD.caption_data AND NEW.analyzed_content IS NOT DISTINCT FROM OLD.analyzed_content) THEN
        NEW.analyzed_content := NEW.caption_data::jsonb;
    END IF;
    
    -- When analyzed_content is updated but caption_data is not
    IF (NEW.analyzed_content IS DISTINCT FROM OLD.analyzed_content AND NEW.caption_data IS NOT DISTINCT FROM OLD.caption_data) THEN
        NEW.caption_data := NEW.analyzed_content::text;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger function to log deleted messages
CREATE OR REPLACE FUNCTION public.xdelo_log_deleted_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert the deleted message info into deleted_messages table
    INSERT INTO deleted_messages (
        original_id,
        telegram_message_id,
        chat_id,
        media_group_id,
        file_unique_id,
        caption,
        message_data,
        analyzed_content,
        deleted_at,
        deleted_by,
        deletion_reason,
        deletion_metadata
    ) VALUES (
        OLD.id,
        OLD.telegram_message_id,
        OLD.chat_id,
        OLD.media_group_id,
        OLD.file_unique_id,
        OLD.caption,
        OLD.message_data,
        OLD.analyzed_content,
        NOW(),
        current_setting('app.deleted_by', true),
        current_setting('app.deletion_reason', true),
        jsonb_build_object(
            'deleted_via', current_setting('app.deletion_source', true),
            'correlation_id', current_setting('app.correlation_id', true)
        )
    );
    
    -- Log the deletion to audit logs
    INSERT INTO unified_audit_logs (
        event_type,
        chat_id,
        message_id,
        file_unique_id,
        media_group_id,
        entity_id,
        entity_type,
        operation_type,
        correlation_id,
        metadata,
        previous_state
    ) VALUES (
        'message_deleted',
        OLD.chat_id,
        OLD.telegram_message_id,
        OLD.file_unique_id,
        OLD.media_group_id,
        OLD.id,
        'messages',
        'delete',
        current_setting('app.correlation_id', true),
        jsonb_build_object(
            'deleted_by', current_setting('app.deleted_by', true),
            'deletion_reason', current_setting('app.deletion_reason', true),
            'deleted_via', current_setting('app.deletion_source', true)
        ),
        row_to_json(OLD)::jsonb
    );
    
    RETURN OLD;
END;
$$;

-- Trigger function to log message changes
CREATE OR REPLACE FUNCTION public.log_messages_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      previous_state,
      new_state,
      telegram_message_id,
      chat_id
    ) VALUES (
      'message_updated',
      NEW.id,
      row_to_json(OLD)::jsonb,
      (row_to_json(NEW)::jsonb) - 'telegram_data',
      NEW.telegram_message_id,
      NEW.chat_id
    );
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger function to check media group on message change
CREATE OR REPLACE FUNCTION public.check_media_group_on_message_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed for messages in a media group that don't have a caption
    -- and are in 'initialized' or 'pending' state
    IF NEW.media_group_id IS NOT NULL 
       AND (NEW.caption IS NULL OR NEW.caption = '')
       AND NEW.analyzed_content IS NULL
       AND NEW.processing_state IN ('initialized', 'pending') THEN
    
        -- Attempt to sync from media group
        DECLARE
            v_source_message_id uuid;
        BEGIN
            -- Find a suitable caption message
            v_source_message_id := xdelo_find_caption_message(NEW.media_group_id);
            
            IF v_source_message_id IS NOT NULL THEN
                -- Sync content from the found message
                PERFORM xdelo_sync_media_group_content(
                    v_source_message_id,
                    NEW.media_group_id,
                    COALESCE(NEW.correlation_id, gen_random_uuid()::text)
                );
            END IF;
        END;
    END IF;
  
    RETURN NEW;
END;
$$;

-- Note: Secondary utility triggers for product-related fields and file URLs have been intentionally excluded as they're not part of the core media synchronization logic

-- Now create the actual triggers

-- Media Group Synchronization Trigger
CREATE TRIGGER after_message_update_sync_media_group
AFTER INSERT OR UPDATE OF analyzed_content, caption ON public.messages
FOR EACH ROW
WHEN (new.media_group_id IS NOT NULL)
EXECUTE FUNCTION trigger_sync_media_group_captions();

-- Prevent Unnecessary Updates Trigger
CREATE TRIGGER before_message_update_prevent_loops
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION prevent_unnecessary_message_updates();

-- Ensure Caption Fields Sync Trigger
CREATE TRIGGER ensure_caption_fields_sync
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION sync_caption_fields_trigger();

-- Note: Product-related triggers have been intentionally excluded as they're not part of the core media synchronization logic

-- Deleted Message Logging Trigger
CREATE TRIGGER xdelo_trg_log_deleted_message
BEFORE DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_log_deleted_message();

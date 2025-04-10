-- Migration: 20250410_fix_audit_logs_references.sql
-- Description: Replace all references to audit_logs with unified_audit_logs

-- =====================================
-- Step 1: Update trigger function
-- =====================================

CREATE OR REPLACE FUNCTION public.trigger_sync_media_group_captions()
RETURNS TRIGGER AS $$
DECLARE
  _sync_state text;
  _sync_error text;
  _sync_result uuid[];
  _old_record jsonb := NULL;
  _new_record jsonb;
  v_sync_in_progress boolean := false;
BEGIN
  -- Don't sync if we're running in a recursive context (to prevent infinite loops)
  -- This uses the transaction-level variable to detect recursive calls
  IF current_setting('app.media_group_sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Get the old and new records as JSONB for easier comparison
  IF TG_OP = 'UPDATE' THEN
    _old_record := row_to_json(OLD)::jsonb;
  END IF;
  _new_record := row_to_json(NEW)::jsonb;

  -- Skip if there's no media group or if sync is not needed (no relevant changes)
  IF NEW.media_group_id IS NULL OR NOT public.should_sync_media_group(_old_record, _new_record) THEN
    RETURN NEW;
  END IF;
  
  -- Set sync state based on current processing state to maintain semantics
  _sync_state := NEW.processing_state;
  
  BEGIN
    -- Set the transaction-level variable to prevent recursive triggers
    PERFORM set_config('app.media_group_sync_in_progress', 'true', true);
    
    -- Call the sync function
    _sync_result := public.sync_media_group_captions(
      NEW.id,
      NEW.media_group_id,
      NEW.caption,
      NEW.analyzed_content,
      _sync_state::public.processing_state_type
    );
    
    -- Log successful sync to audit trail
    INSERT INTO public.unified_audit_logs (
      action_type,
      table_name,
      record_id,
      action_data,
      user_id
    ) VALUES (
      'media_group_sync',
      'messages',
      NEW.id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption,
        'affected_messages', _sync_result,
        'processing_state', _sync_state
      ),
      NULL
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    _sync_error := SQLERRM;
    
    INSERT INTO public.unified_audit_logs (
      action_type,
      table_name,
      record_id,
      action_data,
      user_id
    ) VALUES (
      'media_group_sync_error',
      'messages',
      NEW.id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption,
        'error', _sync_error
      ),
      NULL
    );
    
  FINALLY
    -- Always reset the transaction variable
    PERFORM set_config('app.media_group_sync_in_progress', 'false', true);
  END;
  
  -- Always return the NEW record to continue the transaction
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- Step 2: Update documentation comment
-- =====================================

COMMENT ON FUNCTION public.trigger_sync_media_group_captions() IS 
'Trigger function that automatically synchronizes media group messages

This trigger fires AFTER INSERT or UPDATE on the messages table when
analyzed_content or caption changes on a message with a media_group_id.
It ensures all messages in the same group have consistent content.

The function implements safeguards to prevent infinite recursion
and logs all operations to the unified_audit_logs table with detailed metadata.

Key operations:
1. Detects relevant changes to caption or analyzed_content
2. Calls sync_media_group_captions function with appropriate parameters
3. Records sync operations in unified_audit_logs for monitoring
4. Handles errors gracefully without failing the transaction

@trigger AFTER INSERT OR UPDATE OF analyzed_content, caption ON public.messages
@condition NEW.media_group_id IS NOT NULL';

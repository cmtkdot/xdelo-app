-- Migration: Enhanced Message Edits and Duplicates Handling
-- Implements full support for edited messages (text and media) and duplicate handling
-- Integrates with the existing editedMessageHandler.ts logic

BEGIN;

-- 1. Create message edit history table (separate from messages for better performance)
CREATE TABLE IF NOT EXISTS message_edit_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    edited_at timestamptz NOT NULL DEFAULT now(),
    editor_user_id bigint,
    previous_text text,
    new_text text,
    previous_caption text,
    new_caption text,
    previous_telegram_data jsonb,
    new_telegram_data jsonb,
    edit_reason text,
    is_channel_post boolean DEFAULT false,
    edit_source text CHECK (edit_source IN ('user', 'admin', 'system', 'channel'))
);

CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id ON message_edit_history(message_id);
CREATE INDEX IF NOT EXISTS idx_message_edit_history_edited_at ON message_edit_history(edited_at);

-- 2. Add columns to messages table for enhanced edit tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_edit_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_edit_user_id bigint;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_channel_post boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edit_source text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS original_message_id uuid REFERENCES messages(id);

-- 3. Create function to handle message edits (text and media)
CREATE OR REPLACE FUNCTION public.handle_message_edit(
    p_message_id uuid,
    p_telegram_message_id bigint,
    p_chat_id bigint,
    p_new_text text,
    p_new_caption text,
    p_telegram_data jsonb,
    p_is_channel_post boolean DEFAULT false,
    p_edit_source text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_record messages%ROWTYPE;
    v_edit_history_id uuid;
    v_result jsonb;
BEGIN
    -- Get existing message
    SELECT * INTO v_existing_record FROM messages WHERE id = p_message_id;

    IF v_existing_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Message not found',
            'code', 'MESSAGE_NOT_FOUND'
        );
    END IF;

    -- Record edit history
    INSERT INTO message_edit_history (
        message_id,
        editor_user_id,
        previous_text,
        new_text,
        previous_caption,
        new_caption,
        previous_telegram_data,
        new_telegram_data,
        is_channel_post,
        edit_source
    ) VALUES (
        p_message_id,
        p_telegram_data->>'from_id',
        v_existing_record.text,
        p_new_text,
        v_existing_record.caption,
        p_new_caption,
        v_existing_record.telegram_data,
        p_telegram_data,
        p_is_channel_post,
        p_edit_source
    ) RETURNING id INTO v_edit_history_id;

    -- Update message
    UPDATE messages SET
        text = CASE WHEN p_new_text IS NOT NULL THEN p_new_text ELSE text END,
        caption = CASE WHEN p_new_caption IS NOT NULL THEN p_new_caption ELSE caption END,
        telegram_data = p_telegram_data,
        last_edit_at = now(),
        last_edit_user_id = (p_telegram_data->>'from_id')::bigint,
        is_channel_post = p_is_channel_post,
        edit_source = p_edit_source,
        updated_at = now(),
        edit_count = COALESCE(edit_count, 0) + 1
    WHERE id = p_message_id
    RETURNING
        id,
        telegram_message_id,
        chat_id,
        text,
        caption,
        edit_count,
        last_edit_at
    INTO v_result;

    RETURN jsonb_build_object(
        'status', 'success',
        'message_id', p_message_id,
        'edit_history_id', v_edit_history_id,
        'edit_count', (v_result->>'edit_count')::int,
        'last_edit_at', (v_result->>'last_edit_at')::timestamptz
    );
END;
$$;

-- 4. Enhanced duplicate handling function (integrates with edit handling)
CREATE OR REPLACE FUNCTION public.md_handle_duplicate_media_message(
    p_file_unique_id text,
    p_chat_id bigint,
    p_telegram_message_id bigint,
    p_media_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Ensure correct schema context
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
  v_debug_info jsonb;
  v_error_details text;
  v_existing_caption text;
  v_new_caption text;
  v_caption_changed boolean := false;
  v_needs_analysis boolean := false;
  v_result jsonb;
  v_existing_record messages%ROWTYPE; -- To hold the full existing record if needed
  v_is_edit boolean := (p_media_data->>'is_edit')::boolean;
  v_edit_source text := p_media_data->>'edit_source';
BEGIN
  -- Parameter validation (Example - adapt as needed)
  IF p_file_unique_id IS NULL OR p_chat_id IS NULL OR p_telegram_message_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters (file_unique_id, chat_id, telegram_message_id)';
  END IF;

  -- First check if the exact message ID already exists for this chat
  BEGIN
    SELECT id INTO v_existing_id
    FROM messages
    WHERE telegram_message_id = p_telegram_message_id
      AND chat_id = p_chat_id
    LIMIT 1;

    -- If the exact message exists, just return its ID with status
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'message_id', v_existing_id,
        'status', 'exact_match',
        'needs_processing', false -- Exact match never needs reprocessing here
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but continue processing
    v_error_details := 'Error checking for existing message: ' || SQLERRM;
    RAISE WARNING '[md_handle_duplicate_media_message] %', v_error_details;
    -- Consider if this error should be fatal or logged differently
  END;

  -- Check if the file exists for this chat (but different message ID)
  BEGIN
    SELECT * INTO v_existing_record
    FROM messages
    WHERE file_unique_id = p_file_unique_id
      AND chat_id = p_chat_id
    ORDER BY created_at DESC -- Get the most recent one if multiple exist somehow
    LIMIT 1;

    -- If file exists, check if we need to process it
    IF v_existing_record IS NOT NULL THEN
      v_existing_id := v_existing_record.id;

      -- *** START: Enhanced edit handling ***
      IF v_is_edit THEN
          -- Handle as an edit of existing media message
          RETURN public.handle_message_edit(
              v_existing_id,
              p_telegram_message_id,
              p_chat_id,
              NULL, -- No text change
              p_media_data->>'caption', -- New caption
              p_media_data,
              (p_media_data->>'is_channel_post')::boolean,
              v_edit_source
          );
      END IF;
      -- *** END: Enhanced edit handling ***

      -- Continue with duplicate handling logic if it wasn't an edit
      v_existing_caption := v_existing_record.caption;
      -- Check if analyzed_content is null, empty jsonb '{}', or literal 'null' jsonb
      v_needs_analysis := (v_existing_record.analyzed_content IS NULL OR v_existing_record.analyzed_content = '{}'::jsonb OR v_existing_record.analyzed_content = 'null'::jsonb);

      -- Get new caption from input data
      v_new_caption := p_media_data->>'caption';

      -- Determine if caption has changed (handle NULLs correctly)
      v_caption_changed := (v_existing_caption IS DISTINCT FROM v_new_caption);

      -- Update the existing record with the new telegram data and message ID
      -- Conditionally update other fields based on changes
      UPDATE messages
      SET
        telegram_message_id = p_telegram_message_id,
        telegram_data = COALESCE(p_media_data->'telegram_data', telegram_data), -- Keep old if new is null/missing
        media_group_id = COALESCE(p_media_data->>'media_group_id', media_group_id), -- Keep old if new is null/missing

        -- Only update caption if it's changed
        caption = CASE
          WHEN v_caption_changed THEN v_new_caption
          ELSE caption
        END,

        -- Archive the current analyzed_content if caption changed and content exists
        old_analyzed_content = CASE
          WHEN v_caption_changed AND NOT v_needs_analysis -- Only archive if there was content
            THEN array_append(COALESCE(old_analyzed_content, ARRAY[]::jsonb[]), analyzed_content)
          ELSE old_analyzed_content
        END,

        -- Reset analyzed_content only if caption changed
        analyzed_content = CASE
          WHEN v_caption_changed THEN NULL
          ELSE analyzed_content
        END,

        -- Reset processing state only if caption changed or needs analysis
        processing_state = CASE
          WHEN v_caption_changed OR v_needs_analysis THEN 'pending'::message_processing_state -- Ensure correct enum type
          ELSE processing_state
        END,

        -- Reset sync status if caption changed
        group_caption_synced = CASE
          WHEN v_caption_changed THEN false
          ELSE group_caption_synced
        END,
        message_caption_id = CASE -- Assuming this relates to caption parsing
          WHEN v_caption_changed THEN NULL
          ELSE message_caption_id
        END,

        updated_at = now(),
        is_duplicate = true,
        duplicate_reference_id = v_existing_id -- Reference the record we are updating
      WHERE id = v_existing_id;

      -- Return ID and status information
      RETURN jsonb_build_object(
        'message_id', v_existing_id,
        'status', 'duplicate',
        'caption_changed', v_caption_changed,
        'needs_analysis', v_needs_analysis,
        'needs_processing', (v_caption_changed OR v_needs_analysis) -- Determine if processing is needed
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but continue processing to attempt insert
    v_error_details := 'Error checking for existing file: ' || SQLERRM;
    RAISE WARNING '[md_handle_duplicate_media_message] %', v_error_details;
    -- Consider if this error should be fatal or logged differently
  END;

  -- If no record exists (neither exact match nor duplicate file), create a new one
  BEGIN
    INSERT INTO messages (
      telegram_message_id,
      chat_id,
      file_unique_id,
      media_type,
      caption,
      telegram_data,
      media_group_id,
      storage_package, -- Assuming this comes from p_media_data or is handled elsewhere
      processing_state,
      is_duplicate,
      created_at,
      updated_at
    )
    VALUES (
      p_telegram_message_id,
      p_chat_id,
      p_file_unique_id,
      p_media_data->>'media_type', -- Extract from p_media_data
      p_media_data->>'caption',    -- Extract from p_media_data
      p_media_data->'telegram_data', -- Extract from p_media_data
      p_media_data->>'media_group_id', -- Extract from p_media_data
      p_media_data->'storage_package', -- Extract from p_media_data
      'pending'::message_processing_state, -- New messages always start as pending
      false, -- Not a duplicate
      now(),
      now()
    )
    RETURNING id INTO v_new_id;

    -- Return ID with status for a new record
    RETURN jsonb_build_object(
      'message_id', v_new_id,
      'status', 'new',
      'needs_processing', true -- New records always need processing
    );

  EXCEPTION WHEN unique_violation THEN
      -- Handle potential race condition if another process inserted the message between checks
      RAISE WARNING '[md_handle_duplicate_media_message] Unique violation during insert for message % in chat %. Attempting re-check.', p_telegram_message_id, p_chat_id;
      -- Re-query to find the now existing message
      SELECT id INTO v_existing_id
      FROM messages
      WHERE telegram_message_id = p_telegram_message_id AND chat_id = p_chat_id
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
          RETURN jsonb_build_object(
              'message_id', v_existing_id,
              'status', 'exact_match_race', -- Indicate race condition resolved
              'needs_processing', false
          );
      ELSE
          -- This case should ideally not happen if unique constraint is on (telegram_message_id, chat_id)
          RAISE EXCEPTION '[md_handle_duplicate_media_message] Unique violation but failed to find existing message after race condition for message % in chat %', p_telegram_message_id, p_chat_id;
      END IF;
    WHEN OTHERS THEN
      v_error_details := 'Error inserting new message: ' || SQLERRM;
      -- Log error details
      INSERT INTO unified_audit_logs (event_type, entity_type, metadata, error_message, telegram_message_id, chat_id)
      VALUES ('db_insert_error', 'messages', p_media_data, v_error_details, p_telegram_message_id, p_chat_id);
      RAISE EXCEPTION '%', v_error_details; -- Re-raise the exception
  END;
END;
$$;

-- 5. Create trigger for automatic edit history
CREATE OR REPLACE FUNCTION log_message_edit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.text IS DISTINCT FROM OLD.text OR NEW.caption IS DISTINCT FROM OLD.caption THEN
        INSERT INTO message_edit_history (
            message_id,
            editor_user_id,
            previous_text,
            new_text,
            previous_caption,
            new_caption,
            previous_telegram_data,
            new_telegram_data,
            is_channel_post,
            edit_source
        ) VALUES (
            NEW.id,
            NEW.last_edit_user_id,
            OLD.text,
            NEW.text,
            OLD.caption,
            NEW.caption,
            OLD.telegram_data,
            NEW.telegram_data,
            NEW.is_channel_post,
            NEW.edit_source
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_edit
AFTER UPDATE ON messages
FOR EACH ROW
WHEN (
    OLD.text IS DISTINCT FROM NEW.text OR
    OLD.caption IS DISTINCT FROM NEW.caption OR
    OLD.telegram_data IS DISTINCT FROM NEW.telegram_data
)
EXECUTE FUNCTION log_message_edit_trigger();

-- 6. Update RPC function to handle both edits and duplicates
CREATE OR REPLACE FUNCTION public.handle_media_message(
    p_telegram_message_id bigint,
    p_chat_id bigint,
    p_file_unique_id text,
    p_media_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Ensure correct schema context
AS $$
DECLARE
    v_is_edit boolean := (p_media_data->>'is_edit')::boolean;
    v_result jsonb;
    v_message_id uuid;
    v_needs_processing boolean;
    v_error_details text;
    v_debug_info jsonb; -- Consider removing if md_debug_media_message_handling is removed/not used
    v_correlation_id text;
    v_status text;
BEGIN
    -- Extract correlation_id for logging if available
    v_correlation_id := p_media_data->>'correlation_id'; -- Assuming it's passed in media_data

    -- Log the start of the operation
    INSERT INTO unified_audit_logs (
      event_type,
      entity_type,
      metadata,
      telegram_message_id,
      chat_id,
      correlation_id
    ) VALUES (
      'media_message_handling_started',
      'messages',
      jsonb_build_object(
        'telegram_message_id', p_telegram_message_id,
        'chat_id', p_chat_id,
        'file_unique_id', p_file_unique_id
        -- Avoid logging full p_media_data unless necessary for debugging privacy
      ),
      p_telegram_message_id,
      p_chat_id,
      v_correlation_id
    );

    -- Use the helper function to handle the media message
    BEGIN
      -- Call the modified function that returns jsonb with status info
      SELECT public.md_handle_duplicate_media_message(
        p_file_unique_id,
        p_chat_id,
        p_telegram_message_id,
        p_media_data
      ) INTO v_result;

      -- Extract values from the result
      v_message_id := (v_result->>'message_id')::uuid;
      v_status := v_result->>'status';
      v_needs_processing := (v_result->>'needs_processing')::boolean; -- Cast to boolean

      -- Add safety check to ensure v_message_id is not null after the call
      IF v_message_id IS NULL THEN
        -- Log critical error - message ID should always be returned by the helper
        v_error_details := 'md_handle_duplicate_media_message returned NULL message_id';
        INSERT INTO unified_audit_logs (event_type, entity_type, metadata, error_message, telegram_message_id, chat_id, correlation_id)
        VALUES ('critical_db_error', 'messages', v_result, v_error_details, p_telegram_message_id, p_chat_id, v_correlation_id);
        RAISE EXCEPTION 'Critical Error: Failed to get message_id from md_handle_duplicate_media_message. Result: %', v_result::text;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_details := 'Error calling md_handle_duplicate_media_message: ' || SQLERRM;
      -- Log the error
      INSERT INTO unified_audit_logs (event_type, entity_type, metadata, error_message, telegram_message_id, chat_id, correlation_id)
      VALUES ('db_rpc_error', 'messages', p_media_data, v_error_details, p_telegram_message_id, p_chat_id, v_correlation_id);
      RAISE EXCEPTION '%', v_error_details; -- Re-raise the exception
    END;

    -- Log the successful operation outcome with detailed info
    INSERT INTO unified_audit_logs (
      event_type,
      entity_type,
      message_id,
      metadata,
      telegram_message_id,
      chat_id,
      correlation_id
    ) VALUES (
      'media_message_handled',
      'messages',
      v_message_id,
      jsonb_build_object(
        'telegram_message_id', p_telegram_message_id,
        'chat_id', p_chat_id,
        'file_unique_id', p_file_unique_id,
        'status', v_status,
        'needs_processing', v_needs_processing,
        'duplicate_info', CASE WHEN v_status = 'duplicate' THEN v_result ELSE NULL END -- Only include full result for duplicates
      ),
      p_telegram_message_id,
      p_chat_id,
      v_correlation_id
    );

    -- Return full result containing message_id and status information
    RETURN v_result;
END;
$$;

COMMIT;

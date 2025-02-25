-- Add indexes for edited_channel_post and update_id fields
CREATE INDEX IF NOT EXISTS idx_messages_edited_channel_post ON public.messages USING btree (edited_channel_post) TABLESPACE pg_default
WHERE (edited_channel_post IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_messages_update_id ON public.messages USING btree (update_id) TABLESPACE pg_default
WHERE (update_id IS NOT NULL);

-- Add index for edit_history to improve performance when querying edited messages
CREATE INDEX IF NOT EXISTS idx_messages_edit_history ON public.messages USING gin (edit_history) TABLESPACE pg_default
WHERE (edit_history IS NOT NULL);

-- Add index for is_edited to quickly find all edited messages
CREATE INDEX IF NOT EXISTS idx_messages_is_edited_true ON public.messages USING btree (is_edited) TABLESPACE pg_default
WHERE (is_edited = true);

-- Add a function to create a logger utility
CREATE OR REPLACE FUNCTION public.xdelo_get_logger(p_correlation_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN jsonb_build_object(
    'info', jsonb_build_object(
      'fn', 'log',
      'correlation_id', p_correlation_id
    ),
    'warn', jsonb_build_object(
      'fn', 'warn',
      'correlation_id', p_correlation_id
    ),
    'error', jsonb_build_object(
      'fn', 'error',
      'correlation_id', p_correlation_id
    )
  );
END;
$$;

-- Add a function to handle message edits
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_caption text;
  v_new_caption text;
  v_edit_date timestamp with time zone;
  v_is_channel_post boolean;
  v_edit_history jsonb;
  v_new_entry jsonb;
BEGIN
  -- Only proceed if this is an edit
  IF NEW.is_edited = true AND (OLD.is_edited IS NULL OR OLD.is_edited = false OR NEW.caption != OLD.caption) THEN
    -- Get previous and new caption
    v_previous_caption := COALESCE(OLD.caption, '');
    v_new_caption := COALESCE(NEW.caption, '');
    v_edit_date := COALESCE(NEW.edit_date, now());
    v_is_channel_post := COALESCE(NEW.edited_channel_post IS NOT NULL, false);
    
    -- Create new edit history entry
    v_new_entry := jsonb_build_object(
      'edit_date', v_edit_date,
      'previous_caption', v_previous_caption,
      'new_caption', v_new_caption,
      'is_channel_post', v_is_channel_post
    );
    
    -- Update edit history
    IF OLD.edit_history IS NULL THEN
      v_edit_history := jsonb_build_array(v_new_entry);
    ELSE
      v_edit_history := OLD.edit_history || v_new_entry;
    END IF;
    
    -- Set the edit_history
    NEW.edit_history := v_edit_history;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for message edits
DROP TRIGGER IF EXISTS xdelo_trg_handle_message_edit ON public.messages;
CREATE TRIGGER xdelo_trg_handle_message_edit
BEFORE UPDATE OF caption, is_edited ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.xdelo_handle_message_edit();

-- Add a comment to explain the purpose of this migration
COMMENT ON FUNCTION public.xdelo_handle_message_edit() IS 'Automatically updates the edit_history field when a message is edited';
COMMENT ON FUNCTION public.xdelo_get_logger(text) IS 'Creates a logger utility with correlation ID for consistent logging';

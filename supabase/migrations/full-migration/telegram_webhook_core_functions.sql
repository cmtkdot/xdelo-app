-- Core Telegram Webhook Functions
-- Reference Implementation - 2025-04-11
-- This file contains the essential PostgreSQL functions for the Telegram webhook processing flow
-- These functions are aligned with the TypeScript implementations in the edge functions

-- Create necessary types if they don't exist
DO $$
BEGIN
    -- Create telegram_chat_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'telegram_chat_type') THEN
        CREATE TYPE telegram_chat_type AS ENUM ('private', 'group', 'supergroup', 'channel');
    END IF;

    -- Create processing_state_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_state_type') THEN
        CREATE TYPE processing_state_type AS ENUM (
            'initialized',
            'pending',
            'processing',
            'processed',
            'completed',
            'pending_analysis',
            'duplicate',
            'download_failed_forwarded',
            'error'
        );
    END IF;
END$$;

-- 1. Upsert Media Message Function
CREATE OR REPLACE FUNCTION public.upsert_media_message(
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_file_unique_id TEXT,
    p_file_id TEXT,
    p_storage_path TEXT,
    p_public_url TEXT,
    p_mime_type TEXT,
    p_extension TEXT,
    p_media_type TEXT,
    p_caption TEXT,
    p_processing_state TEXT,
    p_message_data JSONB,
    p_correlation_id TEXT,
    p_user_id BIGINT DEFAULT NULL,
    p_media_group_id TEXT DEFAULT NULL,
    p_forward_info JSONB DEFAULT NULL,
    p_processing_error TEXT DEFAULT NULL,
    p_caption_data JSONB DEFAULT NULL,
    p_old_analyzed_content JSONB[] DEFAULT NULL,
    p_analyzed_content JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_exists BOOLEAN;
    v_existing_record RECORD;
    v_is_duplicate BOOLEAN := FALSE;
    v_is_caption_change BOOLEAN := FALSE;
    v_processing_state processing_state_type;
    v_current_analyzed_content JSONB := NULL;
    v_old_analyzed_content JSONB[] := COALESCE(p_old_analyzed_content, ARRAY[]::JSONB[]);
    v_analyzed_content JSONB := p_analyzed_content;
    v_caption_data JSONB := p_caption_data;
    v_event_type TEXT;
BEGIN
    -- Validate processing_state
    BEGIN
        v_processing_state := p_processing_state::processing_state_type;
    EXCEPTION WHEN OTHERS THEN
        v_processing_state := 'initialized'::processing_state_type;
    END;
    
    -- Check if this is a duplicate message (by file_unique_id)
    SELECT 
        id, 
        caption, 
        analyzed_content,
        caption_data
    INTO v_existing_record
    FROM public.messages
    WHERE file_unique_id = p_file_unique_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    v_exists := FOUND;
    
    -- Handle duplicate with different caption case
    IF v_exists THEN
        v_id := v_existing_record.id;
        v_is_duplicate := TRUE;
        
        -- Check if caption has changed
        IF (v_existing_record.caption IS DISTINCT FROM p_caption) THEN
            v_is_caption_change := TRUE;
            
            -- Store the current analyzed_content in old_analyzed_content array
            IF v_existing_record.analyzed_content IS NOT NULL AND v_existing_record.analyzed_content != 'null'::jsonb THEN
                -- Ensure old_analyzed_content is an array
                IF p_old_analyzed_content IS NULL THEN
                    v_old_analyzed_content := ARRAY[v_existing_record.analyzed_content];
                ELSE
                    v_old_analyzed_content := array_append(p_old_analyzed_content, v_existing_record.analyzed_content);
                END IF;
            END IF;
            
            -- Use the new analyzed_content or caption_data if provided
            IF p_analyzed_content IS NOT NULL THEN
                v_analyzed_content := p_analyzed_content;
            ELSIF p_caption_data IS NOT NULL THEN
                v_analyzed_content := p_caption_data;
            END IF;
            
            -- Use new caption_data if provided, otherwise use existing
            IF p_caption_data IS NOT NULL THEN
                v_caption_data := p_caption_data;
            ELSE
                v_caption_data := v_existing_record.caption_data;
            END IF;
            
            -- For caption changes, set processing_state to pending_analysis
            v_processing_state := 'pending_analysis'::processing_state_type;
            
            -- Event type for logging
            v_event_type := 'media_message_caption_update';
        ELSE
            -- No caption change for duplicate
            v_event_type := 'media_message_duplicate';
            
            -- Keep existing analyzed_content
            v_analyzed_content := v_existing_record.analyzed_content;
            
            -- Keep existing caption_data
            v_caption_data := v_existing_record.caption_data;
        END IF;
        
        -- Update the existing record
        UPDATE public.messages SET
            telegram_message_id = p_telegram_message_id,
            chat_id = p_chat_id,
            file_id = p_file_id,
            storage_path = p_storage_path,
            public_url = p_public_url,
            mime_type = p_mime_type,
            extension = p_extension,
            media_type = p_media_type,
            caption = p_caption,
            updated_at = NOW(),
            processing_state = 
                CASE 
                    WHEN v_is_caption_change THEN 'pending_analysis'::processing_state_type
                    ELSE v_processing_state
                END,
            media_group_id = COALESCE(p_media_group_id, media_group_id),
            forward_info = COALESCE(p_forward_info, forward_info),
            message_data = COALESCE(p_message_data, message_data),
            processing_error = COALESCE(p_processing_error, processing_error),
            caption_data = v_caption_data,
            analyzed_content = v_analyzed_content,
            old_analyzed_content = v_old_analyzed_content,
            correlation_id = p_correlation_id,
            is_duplicate = TRUE
        WHERE id = v_id
        RETURNING id INTO v_id;
    ELSE
        -- Insert a new record
        INSERT INTO public.messages (
            telegram_message_id,
            chat_id,
            file_unique_id,
            file_id,
            storage_path,
            public_url,
            mime_type,
            extension,
            media_type,
            caption,
            processing_state,
            message_data,
            media_group_id,
            forward_info,
            processing_error,
            caption_data,
            analyzed_content,
            old_analyzed_content,
            correlation_id,
            user_id,
            created_at,
            updated_at
        ) VALUES (
            p_telegram_message_id,
            p_chat_id,
            p_file_unique_id,
            p_file_id,
            p_storage_path,
            p_public_url,
            p_mime_type,
            p_extension,
            p_media_type,
            p_caption,
            v_processing_state,
            p_message_data,
            p_media_group_id,
            p_forward_info,
            p_processing_error,
            p_caption_data,
            p_analyzed_content,
            p_old_analyzed_content,
            p_correlation_id,
            p_user_id,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_id;
        
        v_event_type := 'media_message_creation';
    END IF;
    
    -- Log the operation to unified_audit_logs
    INSERT INTO public.unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata
    ) VALUES (
        v_event_type,
        v_id,
        p_correlation_id,
        jsonb_build_object(
            'telegram_message_id', p_telegram_message_id,
            'chat_id', p_chat_id,
            'media_type', p_media_type,
            'media_group_id', p_media_group_id,
            'is_duplicate', v_is_duplicate,
            'is_caption_change', v_is_caption_change,
            'file_unique_id', p_file_unique_id
        )
    );
    
    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO public.unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message
    ) VALUES (
        'media_message_creation_failed',
        gen_random_uuid(),
        p_correlation_id,
        jsonb_build_object(
            'telegram_message_id', p_telegram_message_id,
            'chat_id', p_chat_id,
            'media_group_id', p_media_group_id
        ),
        SQLERRM
    );
    
    RAISE;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.upsert_media_message IS 'Upserts a media message into the messages table.
Handles both new inserts and updates to existing records based on file_unique_id.
Includes special handling for caption changes on duplicate messages, maintaining edit history.

Parameters:
  p_telegram_message_id (bigint) - Telegram message ID
  p_chat_id (bigint) - Telegram chat ID
  p_file_unique_id (text) - Unique identifier for the file from Telegram
  p_file_id (text) - File ID from Telegram (used for downloading)
  p_storage_path (text) - Path where the file is stored locally
  p_public_url (text) - Public URL for accessing the file
  p_mime_type (text) - MIME type of the media file
  p_extension (text) - File extension
  p_media_type (text) - Type of media (photo, video, document, etc.)
  p_caption (text) - Caption text for the media
  p_processing_state (text) - Current processing state
  p_message_data (jsonb) - Complete Telegram message object
  p_correlation_id (text) - Unique ID for tracking the request
  p_user_id (bigint) - Optional user ID
  p_media_group_id (text) - Group ID for grouped media messages
  p_forward_info (jsonb) - Information about forwarded messages
  p_processing_error (text) - Error message if processing failed
  p_caption_data (jsonb) - Structured data extracted from caption
  p_old_analyzed_content (jsonb[]) - Array of previous analyzed_content values
  p_analyzed_content (jsonb) - Current analyzed content from the caption

Returns: UUID of the inserted or updated message record.

Key behaviors:
1. Detects duplicates by file_unique_id
2. Handles caption changes on duplicates, preserving history
3. Resets processing state when captions change
4. Logs operations to unified_audit_logs';

-- 2. Upsert Text Message Function
CREATE OR REPLACE FUNCTION public.upsert_text_message(
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_message_text TEXT,
    p_message_data JSONB,
    p_correlation_id TEXT,
    p_chat_type TEXT DEFAULT NULL,
    p_chat_title TEXT DEFAULT NULL,
    p_forward_info JSONB DEFAULT NULL,
    p_processing_state TEXT DEFAULT 'pending_analysis',
    p_processing_error TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_exists BOOLEAN;
    v_is_edit BOOLEAN := FALSE;
    v_processing_state processing_state_type;
    v_chat_type telegram_chat_type;
    v_event_type TEXT;
BEGIN
    -- Validate processing_state
    BEGIN
        v_processing_state := p_processing_state::processing_state_type;
    EXCEPTION WHEN OTHERS THEN
        v_processing_state := 'initialized'::processing_state_type;
    END;
    
    -- Validate chat_type
    IF p_chat_type IS NOT NULL THEN
        BEGIN
            v_chat_type := p_chat_type::telegram_chat_type;
        EXCEPTION WHEN OTHERS THEN
            v_chat_type := NULL;
        END;
    END IF;
    
    -- Check if this message already exists
    SELECT id INTO v_id
    FROM public.other_messages
    WHERE telegram_message_id = p_telegram_message_id AND chat_id = p_chat_id;
    
    v_exists := FOUND;
    
    IF v_exists THEN
        -- Check if message text has changed
        IF EXISTS (
            SELECT 1 
            FROM public.other_messages 
            WHERE id = v_id AND message_text IS DISTINCT FROM p_message_text
        ) THEN
            v_is_edit := TRUE;
        END IF;
        
        -- Update existing record
        UPDATE public.other_messages SET
            message_text = p_message_text,
            message_data = COALESCE(p_message_data, message_data),
            chat_type = COALESCE(v_chat_type, chat_type),
            chat_title = COALESCE(p_chat_title, chat_title),
            forward_info = COALESCE(p_forward_info, forward_info),
            processing_state = 
                CASE 
                    WHEN v_is_edit THEN 'pending_analysis'::processing_state_type
                    ELSE v_processing_state
                END,
            processing_error = COALESCE(p_processing_error, processing_error),
            is_edit = CASE WHEN v_is_edit THEN TRUE ELSE is_edit END,
            updated_at = NOW(),
            correlation_id = p_correlation_id
        WHERE id = v_id;
        
        v_event_type := CASE 
            WHEN v_is_edit THEN 'text_message_edit'
            ELSE 'text_message_duplicate'
        END;
    ELSE
        -- Insert new record
        INSERT INTO public.other_messages (
            telegram_message_id,
            chat_id,
            message_text,
            message_data,
            chat_type,
            chat_title,
            forward_info,
            processing_state,
            processing_error,
            correlation_id,
            created_at,
            updated_at
        ) VALUES (
            p_telegram_message_id,
            p_chat_id,
            p_message_text,
            p_message_data,
            v_chat_type,
            p_chat_title,
            p_forward_info,
            v_processing_state,
            p_processing_error,
            p_correlation_id,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_id;
        
        v_event_type := 'text_message_creation';
    END IF;
    
    -- Log the operation to unified_audit_logs
    INSERT INTO public.unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata
    ) VALUES (
        v_event_type,
        v_id,
        p_correlation_id,
        jsonb_build_object(
            'telegram_message_id', p_telegram_message_id,
            'chat_id', p_chat_id,
            'is_edit', v_is_edit,
            'is_forward', p_forward_info IS NOT NULL
        )
    );
    
    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO public.unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message
    ) VALUES (
        'text_message_creation_failed',
        gen_random_uuid(),
        p_correlation_id,
        jsonb_build_object(
            'telegram_message_id', p_telegram_message_id,
            'chat_id', p_chat_id
        ),
        SQLERRM
    );
    
    RAISE;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.upsert_text_message IS 'Upserts a text message into the other_messages table.
Used for text-only and non-media messages from Telegram, standardizing the handling to match media messages.

Parameters:
  p_telegram_message_id (bigint) - Telegram message ID
  p_chat_id (bigint) - Telegram chat ID
  p_message_text (text) - Text content of the message
  p_message_data (jsonb) - Complete Telegram message object (stored as telegram_data)
  p_correlation_id (text) - Correlation ID for request tracking and logging
  p_chat_type (text) - Type of chat (private, group, supergroup, channel)
  p_chat_title (text) - Title of chat (name or group name)
  p_forward_info (jsonb) - Forward information for forwarded messages
  p_processing_state (text) - Initial processing state (one of: initialized, pending, processing, processed, completed, pending_analysis, duplicate, download_failed_forwarded, error)
  p_processing_error (text) - Processing error message if applicable

Returns: UUID of the inserted or updated message.

Behavior:
- If a message with the same telegram_message_id and chat_id already exists, updates the existing record
- If text has changed, handles edit history appropriately
- Uses proper enum validation for chat_type and processing_state
- Logs message actions to unified_audit_logs table
- Standardizes forward_info handling across both media and text messages';

-- 3. Sync Media Group Captions Function
CREATE OR REPLACE FUNCTION public.sync_media_group_captions(
    p_media_group_id TEXT,
    p_exclude_message_id TEXT,
    p_caption TEXT,
    p_caption_data JSONB,
    p_processing_state processing_state_type DEFAULT 'pending_analysis'
) RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result UUID;
    v_count INTEGER := 0;
BEGIN
    -- Convert exclude_message_id to UUID if it's not already
    FOR v_result IN
        UPDATE public.messages
        SET 
            caption = p_caption,
            caption_data = p_caption_data,
            processing_state = p_processing_state,
            analyzed_content = p_caption_data,
            updated_at = NOW()
        WHERE 
            media_group_id = p_media_group_id
            AND id::TEXT != p_exclude_message_id
        RETURNING id
    LOOP
        v_count := v_count + 1;
        RETURN NEXT v_result;
    END LOOP;
    
    RETURN;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.sync_media_group_captions IS 'Synchronizes captions across all messages in a media group.
Uses SECURITY DEFINER to ensure it has the necessary permissions regardless of calling context.

Parameters:
  p_media_group_id (text) - The media group ID to synchronize
  p_exclude_message_id (text) - Message ID to exclude from synchronization (typically the source message)
  p_caption (text) - Caption text to apply to all messages in the group
  p_caption_data (jsonb) - Structured caption data to apply to all messages
  p_processing_state (processing_state_type) - Processing state to set for updated messages

Returns: Set of UUIDs for all messages that were updated during synchronization.

Security: This function uses SECURITY DEFINER to ensure it has the necessary permissions.';

-- 4. Align Caption and Analyzed Content Function
CREATE OR REPLACE FUNCTION public.align_caption_and_analyzed_content()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER := 0;
    updated_count2 INTEGER := 0;
BEGIN
    -- Update records where caption_data exists but analyzed_content does not
    UPDATE public.messages
    SET analyzed_content = 
        CASE 
            WHEN caption_data IS NULL THEN NULL
            WHEN caption_data = '' THEN NULL
            ELSE 
                CASE 
                    WHEN caption_data::text ~ '^[{\[]' THEN caption_data::jsonb
                    ELSE jsonb_build_object('text', caption_data)
                END
        END
    WHERE (caption_data IS NOT NULL AND caption_data <> '') 
    AND (analyzed_content IS NULL OR analyzed_content = 'null'::jsonb);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Update records where analyzed_content exists but caption_data does not
    WITH to_update AS (
        SELECT id, analyzed_content 
        FROM public.messages
        WHERE analyzed_content IS NOT NULL 
        AND analyzed_content <> 'null'::jsonb
        AND (caption_data IS NULL OR caption_data = '')
    )
    UPDATE public.messages m
    SET caption_data = tu.analyzed_content::text
    FROM to_update tu
    WHERE m.id = tu.id;
    
    GET DIAGNOSTICS updated_count2 = ROW_COUNT;
    updated_count := updated_count + updated_count2;
    
    -- Log the alignment operation
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata
    ) VALUES (
      'caption_analyzed_content_aligned',
      gen_random_uuid(),
      'system',
      jsonb_build_object(
        'updated_records', updated_count,
        'caption_to_analyzed', updated_count,
        'analyzed_to_caption', updated_count2
      )
    );
    
    RETURN updated_count;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.align_caption_and_analyzed_content IS 'Retroactively aligns caption_data and analyzed_content fields in the messages table. 
Returns the number of records updated.';

-- 5. Trigger for Media Group Caption Synchronization
CREATE OR REPLACE FUNCTION public.trigger_sync_media_group_captions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
  
  -- Set the transaction-level variable to prevent recursive triggers
  PERFORM set_config('app.media_group_sync_in_progress', 'true', true);
  
  BEGIN
    -- Call the sync function
    _sync_result := public.sync_media_group_captions(
      NEW.media_group_id,
      NEW.id,
      NEW.caption,
      NEW.caption_data,
      _sync_state::public.processing_state_type
    );
    
    -- Log successful sync to audit trail
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata
    ) VALUES (
      'media_group_sync',
      NEW.id,
      (SELECT correlation_id FROM messages WHERE id = NEW.id),
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption,
        'affected_messages', _sync_result,
        'processing_state', _sync_state
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    _sync_error := SQLERRM;
    
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      error_message
    ) VALUES (
      'media_group_sync_error',
      NEW.id,
      (SELECT correlation_id FROM messages WHERE id = NEW.id),
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption
      ),
      _sync_error
    );
  END;
  
  -- Always reset the transaction variable
  PERFORM set_config('app.media_group_sync_in_progress', 'false', true);
  
  -- Always return the NEW record to continue the transaction
  RETURN NEW;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.trigger_sync_media_group_captions IS 'Trigger function that automatically synchronizes media group messages

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

-- Helper function for the trigger
CREATE OR REPLACE FUNCTION public.should_sync_media_group(old_record jsonb, new_record jsonb)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Always sync for new messages with media_group_id
  IF old_record IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Sync on caption changes
  IF old_record->>'caption' IS DISTINCT FROM new_record->>'caption' THEN
    RETURN TRUE;
  END IF;
  
  -- Sync on caption_data changes
  IF old_record->>'caption_data' IS DISTINCT FROM new_record->>'caption_data' THEN
    RETURN TRUE;
  END IF;
  
  -- Sync on analyzed_content changes
  IF old_record->>'analyzed_content' IS DISTINCT FROM new_record->>'analyzed_content' THEN
    RETURN TRUE;
  END IF;
  
  -- No relevant changes
  RETURN FALSE;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.should_sync_media_group IS 'Helper function that determines if media group synchronization is needed.
Compares old and new record states to detect changes in caption, caption_data, or analyzed_content.
Returns TRUE if synchronization should occur, FALSE otherwise.';

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_sync_media_group_captions ON public.messages;

CREATE TRIGGER trigger_sync_media_group_captions
  AFTER INSERT OR UPDATE OF analyzed_content, caption, caption_data ON public.messages
  FOR EACH ROW
  WHEN (NEW.media_group_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_sync_media_group_captions();

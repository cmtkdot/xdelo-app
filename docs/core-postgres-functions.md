ore PostgreSQL Functions Documentation
1. upsert_media_message
Purpose
Central function for handling all media message operations (photos, videos, documents) in a single atomic transaction.

Features
Handles duplicate detection via file_unique_id
Preserves caption history by moving existing analyzed_content to old_analyzed_content as a single JSONB object
Synchronizes captions across all messages in a media group
Manages processing states automatically
Parameters
| Parameter | Type | Default | Description | |-----------|------|---------|-------------| | p_telegram_message_id | bigint | NULL | Telegram message ID | | p_chat_id | bigint | NULL | Chat ID where message was sent | | p_file_unique_id | text | NULL | Unique file ID from Telegram (key for duplicate detection) | | p_file_id | text | NULL | File ID from Telegram | | p_storage_path | text | NULL | Path where file is stored | | p_public_url | text | NULL | Public URL to access the file | | p_mime_type | text | NULL | MIME type of the file | | p_extension | text | NULL | File extension | | p_media_type | text | NULL | Type of media (photo, video, document, etc.) | | p_caption | text | NULL | Caption text | | p_message_data | jsonb | NULL | Complete Telegram message data | | p_media_group_id | text | NULL | Group ID for messages in an album | | p_forward_info | jsonb | NULL | Information about forwarded messages | | p_processing_state | text | 'initialized' | Processing state for the message | | p_processing_error | text | NULL | Error message if processing failed | | p_caption_data | jsonb | NULL | Structured data from caption | | p_analyzed_content | jsonb | NULL | Structured data from caption (mirror of caption_data) | | p_old_analyzed_content | jsonb | NULL | Previous version of analyzed_content | | p_correlation_id | text | NULL | Request correlation ID for tracing | | p_user_id | bigint | NULL | User ID who sent the message | | p_is_edited | boolean | false | Whether the message is edited | | p_additional_updates | jsonb | NULL | Additional fields to update | | p_telegram_data | jsonb | NULL | Complete Telegram message data |

Return Value
UUID of the created or updated message

Key Logic
Checks for existing records with same file_unique_id
If found, updates the record and preserves history
If caption changes in a media group, synchronizes across all messages
Properly handles edit history and processing states
2. upsert_text_message
Purpose
Handles text and other non-media messages (text, commands, polls, etc.).

Features
Simplified text message handling
Consistent processing state management
Automatic logging of operations
Parameters
| Parameter | Type | Default | Description | |-----------|------|---------|-------------| | p_telegram_message_id | bigint | (required) | Telegram message ID | | p_chat_id | bigint | (required) | Chat ID where message was sent | | p_telegram_data | jsonb | (required) | Complete Telegram message data | | p_message_text | text | NULL | Message text content | | p_message_type | text | 'text' | Type of message (text, command, etc.) | | p_chat_type | text | NULL | Type of chat (private, group, etc.) | | p_chat_title | text | NULL | Title of the chat if available | | p_forward_info | jsonb | NULL | Information about forwarded messages | | p_processing_state | text | 'initialized' | Processing state for the message | | p_correlation_id | text | NULL | Request correlation ID for tracing |

Return Value
UUID of the created or updated message

Key Logic
Uses ON CONFLICT to handle duplicate message IDs
Extracts message date from Telegram data
Logs operations if correlation_id is provided

## Telegram Data Sync Trigger

This trigger ensures the `telegram_data` field is automatically kept in sync with `message_data` for all records in the `messages` table.

```sql
-- Create a function to copy message_data to telegram_data
CREATE OR REPLACE FUNCTION x_sync_telegram_data()
RETURNS TRIGGER AS $$
BEGIN
    -- If message_data exists but telegram_data is NULL, copy the data
    IF NEW.message_data IS NOT NULL AND 
       (NEW.telegram_data IS NULL OR NEW.telegram_data = '{}'::jsonb) THEN
        NEW.telegram_data := NEW.message_data;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that fires before insert or update
CREATE TRIGGER x_trg_sync_telegram_data
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION x_sync_telegram_data();
```

### Purpose
- Ensures `telegram_data` field is always populated when `message_data` exists
- Works automatically for all inserts and updates, regardless of source
- Maintains data consistency across all operations
- Only modifies `telegram_data` when it's NULL or empty

### Usage Notes
- No application code changes required
- Database-level solution that works independently of application logic
- If both fields contain data, `telegram_data` is preserved (not overwritten)
- Applies to all new and updated records
- Does not modify existing records (requires a migration to backfill)

SQL Recreation Scripts
Here are the scripts to recreate both functions:

1. upsert_media_message
sql
CopyInsert
DROP FUNCTION IF EXISTS upsert_media_message(jsonb, text, jsonb, bigint, text, text, text, text, jsonb, text, text, jsonb, text, jsonb, text, text, text, text, bigint, bigint, boolean, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.upsert_media_message(
  p_analyzed_content jsonb DEFAULT NULL::jsonb,
  p_caption text DEFAULT NULL::text,
  p_caption_data jsonb DEFAULT NULL::jsonb,
  p_chat_id bigint DEFAULT NULL::bigint,
  p_correlation_id text DEFAULT NULL::text,
  p_extension text DEFAULT NULL::text,
  p_file_id text DEFAULT NULL::text,
  p_file_unique_id text DEFAULT NULL::text,
  p_forward_info jsonb DEFAULT NULL::jsonb,
  p_media_group_id text DEFAULT NULL::text,
  p_media_type text DEFAULT NULL::text,
  p_message_data jsonb DEFAULT NULL::jsonb,
  p_mime_type text DEFAULT NULL::text,
  p_old_analyzed_content jsonb DEFAULT NULL::jsonb,
  p_processing_error text DEFAULT NULL::text,
  p_processing_state text DEFAULT 'initialized'::text,
  p_public_url text DEFAULT NULL::text,
  p_storage_path text DEFAULT NULL::text,
  p_telegram_message_id bigint DEFAULT NULL::bigint,
  p_user_id bigint DEFAULT NULL::bigint,
  p_is_edited boolean DEFAULT false,
  p_additional_updates jsonb DEFAULT NULL::jsonb,
  p_telegram_data jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_message_id UUID;
  v_message_date TIMESTAMPTZ;
  v_raw_chat_type TEXT;
  v_chat_type public.telegram_chat_type;
  v_chat_title TEXT;
  v_existing_caption TEXT;
  v_existing_analyzed_content JSONB;
  v_caption_changed BOOLEAN := FALSE;
  v_existing_message_id UUID;
  v_processing_state_enum public.processing_state_type;
  v_is_forward BOOLEAN;
BEGIN
  -- Extract message date from message_data
  v_message_date := to_timestamp((p_message_data->>'date')::numeric);
  v_raw_chat_type := p_message_data->'chat'->>'type';
  v_chat_title := p_message_data->'chat'->>'title';
  
  -- Determine if message is forwarded using only the standardized p_forward_info
  v_is_forward := (p_forward_info IS NOT NULL);
  
  -- Validate chat type - make sure it's one of the allowed enum values
  CASE lower(v_raw_chat_type)
    WHEN 'private' THEN v_chat_type := 'private'::public.telegram_chat_type;
    WHEN 'group' THEN v_chat_type := 'group'::public.telegram_chat_type;
    WHEN 'supergroup' THEN v_chat_type := 'supergroup'::public.telegram_chat_type;
    WHEN 'channel' THEN v_chat_type := 'channel'::public.telegram_chat_type;
    ELSE v_chat_type := 'unknown'::public.telegram_chat_type;
  END CASE;
  
  -- Convert processing_state to enum
  BEGIN
    v_processing_state_enum := p_processing_state::public.processing_state_type;
  EXCEPTION WHEN OTHERS THEN
    v_processing_state_enum := 'initialized'::public.processing_state_type;
  END;
  
  -- Check for existing record with same file_unique_id
  SELECT 
    id, 
    caption, 
    analyzed_content 
  INTO 
    v_existing_message_id, 
    v_existing_caption, 
    v_existing_analyzed_content
  FROM public.messages 
  WHERE file_unique_id = p_file_unique_id 
  LIMIT 1;
  
  -- Determine if caption has changed
  v_caption_changed := (
    v_existing_message_id IS NOT NULL AND 
    p_caption IS NOT NULL AND 
    v_existing_caption IS DISTINCT FROM p_caption
  );
  
  -- Update or insert
  IF v_existing_message_id IS NOT NULL THEN
    -- Update existing record
    UPDATE public.messages SET
      telegram_message_id = p_telegram_message_id,
      chat_id = p_chat_id,
      chat_type = v_chat_type,
      chat_title = v_chat_title,
      message_date = v_message_date,
      caption = p_caption,
      media_type = p_media_type,
      file_id = p_file_id,
      -- Don't update file_unique_id - it's our lookup key
      storage_path = COALESCE(p_storage_path, storage_path),
      public_url = COALESCE(p_public_url, public_url),
      mime_type = COALESCE(p_mime_type, mime_type),
      extension = COALESCE(p_extension, extension),
      message_data = p_message_data,
      telegram_data = COALESCE(p_telegram_data, p_message_data),
      -- If caption changed, reset processing state
      processing_state = CASE 
        WHEN v_caption_changed THEN 'initialized'::public.processing_state_type
        ELSE v_processing_state_enum
      END,
      processing_error = p_processing_error,
      is_forward = v_is_forward,
      forward_info = p_forward_info,
      media_group_id = p_media_group_id,
      caption_data = p_caption_data,
      -- Handle analyzed_content and old_analyzed_content
      old_analyzed_content = CASE 
        WHEN v_caption_changed THEN v_existing_analyzed_content
        ELSE p_old_analyzed_content
      END,
      analyzed_content = CASE 
        WHEN v_caption_changed THEN NULL
        ELSE COALESCE(p_analyzed_content, analyzed_content)
      END,
      correlation_id = p_correlation_id,
      updated_at = NOW()
    WHERE id = v_existing_message_id;
    
    -- If caption changed and media_group_id exists, update all messages in the group
    IF v_caption_changed AND p_media_group_id IS NOT NULL THEN
      UPDATE public.messages SET
        caption = p_caption,
        processing_state = 'initialized'::public.processing_state_type,
        old_analyzed_content = v_existing_analyzed_content, -- Store as single JSONB, not array
        updated_at = NOW()
      WHERE 
        media_group_id = p_media_group_id 
        AND id != v_existing_message_id;
    END IF;
    
    v_message_id := v_existing_message_id;
  ELSE
    -- Insert new record
    INSERT INTO public.messages (
      telegram_message_id,
      chat_id,
      chat_type,
      chat_title,
      message_date,
      caption,
      media_type,
      file_id,
      file_unique_id,
      storage_path,
      public_url,
      mime_type,
      extension,
      message_data,
      telegram_data,
      processing_state,
      processing_error,
      is_forward,
      forward_info,
      media_group_id,
      caption_data,
      analyzed_content,
      old_analyzed_content,
      correlation_id
    ) VALUES (
      p_telegram_message_id,
      p_chat_id,
      v_chat_type,
      v_chat_title,
      v_message_date,
      p_caption,
      p_media_type,
      p_file_id,
      p_file_unique_id,
      p_storage_path,
      p_public_url,
      p_mime_type,
      p_extension,
      p_message_data,
      COALESCE(p_telegram_data, p_message_data),
      v_processing_state_enum,
      p_processing_error,
      v_is_forward,
      p_forward_info,
      p_media_group_id,
      p_caption_data,
      p_analyzed_content, -- Simply use p_analyzed_content directly
      p_old_analyzed_content,
      p_correlation_id
    )
    RETURNING id INTO v_message_id;
  END IF;
  
  RETURN v_message_id;
END;
$function$;
2. upsert_text_message
sql
CopyInsert
DROP FUNCTION IF EXISTS upsert_text_message(bigint, bigint, jsonb, text, text, text, text, jsonb, text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.upsert_text_message(
  p_telegram_message_id bigint,
  p_chat_id bigint,
  p_telegram_data jsonb,
  p_message_text text DEFAULT NULL::text,
  p_message_type text DEFAULT 'text'::text,
  p_chat_type text DEFAULT NULL::text,
  p_chat_title text DEFAULT NULL::text,
  p_forward_info jsonb DEFAULT NULL::jsonb,
  p_processing_state text DEFAULT 'initialized'::text,
  p_correlation_id text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_is_forward BOOLEAN;
  v_record_id UUID;
  v_message_date TIMESTAMPTZ;
BEGIN
  -- Determine if message is forwarded using only the standardized p_forward_info
  -- This ensures consistent handling with other functions
  v_is_forward := (p_forward_info IS NOT NULL);
  
  -- Extract message date from telegram data if present
  v_message_date := CASE 
    WHEN p_telegram_data->>'date' IS NOT NULL THEN 
      to_timestamp((p_telegram_data->>'date')::bigint)
    ELSE 
      now() 
  END;
  
  -- Insert or update with simplified approach
  INSERT INTO other_messages (
    telegram_message_id,
    chat_id,
    message_text,
    telegram_data,
    message_type,
    chat_type,
    chat_title,
    message_date,
    is_forward,
    forward_info,
    processing_state
  ) VALUES (
    p_telegram_message_id,
    p_chat_id,
    p_message_text,
    p_telegram_data,
    p_message_type,
    p_chat_type,
    p_chat_title,
    v_message_date,
    v_is_forward,
    p_forward_info,
    p_processing_state
  )
  ON CONFLICT (telegram_message_id, chat_id) 
  DO UPDATE SET
    message_text = EXCLUDED.message_text,
    telegram_data = EXCLUDED.telegram_data,
    message_type = EXCLUDED.message_type,
    chat_type = EXCLUDED.chat_type,
    chat_title = EXCLUDED.chat_title,
    is_forward = EXCLUDED.is_forward,
    forward_info = EXCLUDED.forward_info,
    processing_state = EXCLUDED.processing_state,
    updated_at = now()
  RETURNING id INTO v_record_id;
  
  -- Log the operation if correlation_id is provided
  IF p_correlation_id IS NOT NULL THEN
    INSERT INTO processing_logs (
      event_type,
      message_id,
      correlation_id,
      metadata,
      created_at
    ) VALUES (
      'text_message_upserted',
      v_record_id,
      p_correlation_id,
      jsonb_build_object(
        'telegram_message_id', p_telegram_message_id,
        'chat_id', p_chat_id,
        'is_forward', v_is_forward
      ),
      now()
    );
  END IF;
  
  RETURN v_record_id;
END;
$function$;
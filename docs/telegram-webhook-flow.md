# Telegram Webhook Processing Flow

This document outlines the architecture, flow, and database components of the Telegram Webhook system.

## Database Functions & Triggers

### Database Triggers

| Trigger | Function | Purpose |
|---------|----------|---------|
| `set_public_url` | `xdelo_set_public_url()` | Automatically generates public URLs for stored media when `storage_path` changes |
| `trg_audit_forward_changes` | `xdelo_audit_forward_changes()` | Tracks changes to forwarded status (`is_forward`) |
| `trg_check_media_group_on_message_change` | `xdelo_check_media_group_on_message_change()` | Handles synchronization of media group processing on state changes |
| `trg_ensure_edit_history_consistency` | `xdelo_ensure_edit_history_consistency()` | Maintains consistent edit history across changes |
| `trg_extract_old_analyzed_content` | `xdelo_extract_old_analyzed_content()` | Preserves old analyzed content before changes |
| `trg_process_caption` | `xdelo_process_caption_trigger()` | Processes captions when added or changed |
| `trg_set_file_id_expiration` | `xdelo_set_file_id_expiration()` | Sets expiration for Telegram file IDs |
| `trg_update_media_dimensions` | `update_media_dimensions()` | Extracts and stores media dimensions from `telegram_data` |
| `trg_validate_media_group_sync` | `xdelo_validate_media_group_sync()` | Ensures media groups are properly synchronized |
| `xdelo_product_sku_trigger` | `xdelo_product_sku_generate()` | Generates product SKUs from message data |
| `xdelo_set_purchase_order_uid` | `xdelo_purchase_order_uid()` | Sets purchase order UIDs |
| `xdelo_trg_extract_analyzed_content` | `xdelo_extract_analyzed_content()` | Extracts and processes analyzed content |
| `xdelo_trg_forward_media` | `xdelo_handle_forward_media()` | Handles forwarded media specially |
| `xdelo_trg_handle_forward` | `xdelo_handle_message_forward()` | Processes forwarded messages |
| `xdelo_trg_message_update` | `xdelo_handle_message_update()` | Handles message updates when caption changes |

### Webhook Triggers

| Trigger | Endpoint | Purpose |
|---------|----------|---------|
| `make-update-new` | `https://hook.us2.make.com/v4izci9glangjn7oaeapj1oymavmj876` | Sends webhook to Make.com after INSERT or UPDATE |
| `n8n-webhook` | `https://xdelo.app.n8n.cloud/webhook-test/supabase-new-message` | Sends webhook to n8n automation platform after INSERT, DELETE, or UPDATE |

### RPC Functions

| Function | Purpose | Action |
|----------|---------|--------|
| `xdelo_logProcessingEvent` | Logs processing events to audit trails | Inserts records into `unified_audit_logs` table |
| `createMessage` | Creates new message records | Inserts records into `messages` table |
| `checkDuplicateFile` | Checks if a file already exists | Queries messages by chat_id and telegram_message_id |
| `xdelo_check_media_group_content` | Synchronizes content across media group | Copies analyzed content from one message to others in the group |
| `xdelo_cleanup_orphaned_audit_logs` | Maintenance function | Deletes audit logs that reference non-existent messages |
| `xdelo_clear_all_messages` | Development/testing function | Clears all messages from the database |

## Database Function Definitions

### Forwarding Functions

#### `xdelo_audit_forward_changes`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_audit_forward_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.is_forward AND OLD.is_forward IS DISTINCT FROM NEW.is_forward THEN
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            telegram_message_id,
            chat_id,
            previous_state,
            new_state,
            metadata,
            correlation_id
        ) VALUES (
            'forward_status_changed'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object('is_forward', OLD.is_forward),
            jsonb_build_object('is_forward', NEW.is_forward),
            jsonb_build_object(
                'original_message_id', NEW.original_message_id,
                'forward_count', NEW.forward_count
            ),
            NEW.correlation_id
        );
    END IF;
    RETURN NULL;
END;
$function$
```

### Media Group Functions

#### `xdelo_check_media_group_content`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(p_media_group_id text, p_message_id uuid, p_correlation_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_source_message record;
  v_target_message record;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Skip if no media group ID
  IF p_media_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_media_group_id'
    );
  END IF;

  -- Try to acquire an advisory lock on the media group ID
  -- This prevents multiple concurrent attempts to sync the same media group
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_media_group_id));
  
  IF NOT v_lock_acquired THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'media_group_lock_not_acquired',
      'message', 'Another process is currently syncing this media group'
    );
  END IF;

  -- Get the target message details
  SELECT 
    id, 
    analyzed_content, 
    is_original_caption,
    group_caption_synced
  INTO v_target_message
  FROM messages
  WHERE id = p_message_id;
  
  -- If message already has content, skip
  IF v_target_message.analyzed_content IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'reason', 'already_has_content',
      'message_id', p_message_id
    );
  END IF;
  
  -- Find a source message in the same group with analyzed content
  SELECT 
    id, 
    analyzed_content, 
    is_original_caption
  INTO v_source_message
  FROM messages
  WHERE 
    media_group_id = p_media_group_id
    AND id != p_message_id
    AND analyzed_content IS NOT NULL
    AND processing_state = 'completed'
  ORDER BY 
    is_original_caption DESC,
    created_at ASC
  LIMIT 1;
  
  -- If no source message found, return with no action
  IF v_source_message.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_analyzed_content_in_group'
    );
  END IF;
  
  -- Update the target message with data from source message
  UPDATE messages
  SET 
    analyzed_content = v_source_message.analyzed_content,
    message_caption_id = v_source_message.id,
    is_original_caption = false,
    group_caption_synced = true,
    processing_state = 'completed',
    processing_completed_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the sync event
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_content_synced',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', v_source_message.id,
      'method', 'db_check'
    ),
    NOW()
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Synced content from media group',
    'source_message_id', v_source_message.id,
    'is_original_source', v_source_message.is_original_caption
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    error_message,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_sync_error',
    p_message_id,
    p_correlation_id,
    SQLERRM,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'error_detail', SQLSTATE
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'reason', 'error_during_sync'
  );
END;
$function$
```

#### `xdelo_check_media_group_on_message_change`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_on_message_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only proceed for messages in a media group that don't have a caption
  -- and are in 'initialized' or 'pending' state
  IF NEW.media_group_id IS NOT NULL 
     AND (NEW.caption IS NULL OR NEW.caption = '')
     AND NEW.analyzed_content IS NULL
     AND NEW.processing_state IN ('initialized', 'pending') THEN
    
    -- Attempt to sync from media group using the proper function with correlation_id
    PERFORM xdelo_check_media_group_content(NEW.media_group_id, NEW.id, NEW.correlation_id);
  END IF;
  
  RETURN NEW;
END;
$function$
```

#### `xdelo_ensure_edit_history_consistency`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_ensure_edit_history_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If old_analyzed_content has changed and this is part of a media group
    IF NEW.old_analyzed_content IS DISTINCT FROM OLD.old_analyzed_content 
       AND NEW.media_group_id IS NOT NULL 
       AND NEW.is_original_caption = true THEN
       
        -- Sync edit history to all messages in the group
        UPDATE messages
        SET old_analyzed_content = NEW.old_analyzed_content,
            edit_history = NEW.edit_history,
            updated_at = NOW()
        WHERE media_group_id = NEW.media_group_id 
          AND id != NEW.id;
            
        -- Log the synchronization
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            metadata,
            correlation_id,
            event_timestamp
        ) VALUES (
            'media_group_history_synced',
            NEW.id,
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'synced_field', 'edit_history',
                'affected_messages_count', (
                    SELECT COUNT(*) FROM messages 
                    WHERE media_group_id = NEW.media_group_id AND id != NEW.id
                )
            ),
            COALESCE(NEW.correlation_id, gen_random_uuid()::text),
            NOW()
        );
    END IF;
    
    RETURN NULL; -- After trigger doesn't modify the row
END;
$function$
```

#### `xdelo_find_caption_message`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(p_media_group_id text)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_message_id uuid;
BEGIN
  -- First try to find a message that already has caption and analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
    AND analyzed_content IS NOT NULL
    AND is_original_caption = true
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If not found, try to find a message with caption but no analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If still not found, return NULL
  RETURN NULL;
END;
$function$
```

### Content Extraction Functions

#### `xdelo_extract_analyzed_content`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_extract_analyzed_content()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only proceed if analyzed_content has changed and is not null
    IF (TG_OP = 'INSERT' OR OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content) 
       AND NEW.analyzed_content IS NOT NULL THEN
        
        -- Extract fields from analyzed_content
        NEW.product_name := NEW.analyzed_content->>'product_name';
        NEW.product_code := NEW.analyzed_content->>'product_code';
        NEW.vendor_uid := NEW.analyzed_content->>'vendor_uid';
        NEW.purchase_date := (NEW.analyzed_content->>'purchase_date')::date;
        NEW.product_quantity := (NEW.analyzed_content->>'quantity')::numeric;
        NEW.notes := NEW.analyzed_content->>'notes';
        
        -- Update modification timestamp
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$function$
```

#### `xdelo_extract_old_analyzed_content`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_extract_old_analyzed_content()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only proceed if old_analyzed_content has changed and is not null
    IF (TG_OP = 'UPDATE' AND OLD.old_analyzed_content IS DISTINCT FROM NEW.old_analyzed_content) 
       AND OLD.old_analyzed_content IS NOT NULL THEN
        
        -- Extract fields from old_analyzed_content
        NEW.old_product_name := OLD.old_analyzed_content->>'product_name';
        NEW.old_product_code := OLD.old_analyzed_content->>'product_code';
        NEW.old_vendor_uid := OLD.old_analyzed_content->>'vendor_uid';
        NEW.old_purchase_date := (OLD.old_analyzed_content->>'purchase_date')::date;
        NEW.old_product_quantity := (OLD.old_analyzed_content->>'quantity')::numeric;
        
        -- Update modification timestamp
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$function$
```

### Error Handling Functions

#### `xdelo_fail_message_processing`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_fail_message_processing(p_message_id uuid, p_error_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_correlation_id uuid;
BEGIN
  -- Get the correlation ID for logging
  SELECT processing_correlation_id INTO v_correlation_id
  FROM messages
  WHERE id = p_message_id;
  
  -- Update the message to mark as error
  UPDATE messages
  SET 
    processing_state = 'error',
    error_message = p_error_message,
    last_error_at = NOW(),
    retry_count = COALESCE(retry_count, 0) + 1,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the error
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    error_message,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_error',
    p_message_id,
    v_correlation_id::text,
    p_error_message,
    jsonb_build_object(
      'processor', 'direct-caption-processor',
      'error_time', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', p_error_message,
    'message_id', p_message_id
  );
END;
$function$
```

### Maintenance Functions

#### `xdelo_cleanup_orphaned_audit_logs`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_cleanup_orphaned_audit_logs()
RETURNS TABLE(deleted_count bigint)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH deleted AS (
        DELETE FROM unified_audit_logs
        WHERE entity_id NOT IN (SELECT id FROM messages)
        RETURNING id
    )
    SELECT COUNT(*) FROM deleted;
END;
$function$
```

#### `xdelo_clear_all_messages`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_clear_all_messages()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
  start_time TIMESTAMP := clock_timestamp();
  result_json json;
BEGIN
  -- Delete from dependent tables first
  DELETE FROM public.deleted_messages;
  DELETE FROM public.unified_audit_logs WHERE entity_id IN (SELECT id FROM public.messages);
  DELETE FROM public.storage_validations;
  DELETE FROM public.sync_matches;
  
  -- Count and delete all messages
  WITH deleted AS (
    DELETE FROM public.messages
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Log this operation
  INSERT INTO public.gl_sync_logs (
    operation,
    status,
    record_id,
    table_name,
    metadata
  ) VALUES (
    'clear_all_messages',
    'success',
    'system',
    'messages',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'duration_ms', extract(epoch from (clock_timestamp() - start_time)) * 1000
    )
  );
  
  -- Return results as JSON
  SELECT json_build_object(
    'deleted_count', deleted_count,
    'duration_ms', extract(epoch from (clock_timestamp() - start_time)) * 1000
  ) INTO result_json;

  RETURN result_json;
END;
$function$
```

#### `xdelo_find_broken_media_groups`
```sql
CREATE OR REPLACE FUNCTION public.xdelo_find_broken_media_groups()
RETURNS TABLE(media_group_id text, source_message_id uuid, total_count bigint, pending_count bigint, analyzed_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH media_group_stats AS (
    SELECT 
      mg.media_group_id,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE m.processing_state = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) as analyzed_count,
      -- Find a suitable source message
      (SELECT id FROM messages 
       WHERE media_group_id = mg.media_group_id 
         AND is_original_caption = true 
         AND analyzed_content IS NOT NULL
       LIMIT 1) as caption_message_id
    FROM messages m
    JOIN (
      SELECT DISTINCT media_group_id 
      FROM messages 
      WHERE media_group_id IS NOT NULL
      AND deleted_from_telegram = false
    ) mg ON m.media_group_id = mg.media_group_id
    WHERE 
      m.deleted_from_telegram = false
      AND m.media_group_id IS NOT NULL
    GROUP BY mg.media_group_id
  )
  SELECT 
    media_group_id,
    COALESCE(caption_message_id, 
      (SELECT id FROM messages 
       WHERE media_group_id = mgs.media_group_id 
         AND caption IS NOT NULL 
         AND analyzed_content IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 1)
    ) as source_message_id,
    total_count,
    pending_count,
    analyzed_count
  FROM media_group_stats mgs
  WHERE 
    (pending_count > 0 AND analyzed_count > 0) -- Mixed states
    OR (analyzed_count = 0 AND pending_count > 0) -- All pending
  ORDER BY 
    pending_count DESC, 
    total_count DESC
  LIMIT 50;
END;
$function$
```

## Architecture

### Core Edge Functions

#### 1. `telegram-webhook` (Main Entry Point)
- Receives all Telegram updates
- Routes to different handlers based on message type
- Contains message context management
- **Key Files**:
  - `index.ts`: Main webhook handler
  - `dbOperations.ts`: Database operations and event logging
  - `handlers/`: Specialized message handlers

### Shared Components

#### 1. Media Utilities (`_shared/mediaUtils.ts`)
- **Key Functions**:
  - `xdelo_getExtensionFromMimeType`: Maps MIME types to file extensions
  - `xdelo_downloadMediaFromTelegram`: Fetches media from Telegram servers
  - `xdelo_uploadMediaToStorage`: Stores media in Supabase storage
  - `xdelo_validateAndFixStoragePath`: Ensures correct file paths
  - `xdelo_detectMimeType`: Detects actual file types
  - `xdelo_isViewableMimeType`: Checks if media can be displayed in-browser

#### 2. Media Storage (`_shared/mediaStorage.ts`)
- **Key Functions**:
  - `xdelo_findExistingFile`: Checks for duplicate files
  - `xdelo_processMessageMedia`: Orchestrates the media processing workflow

#### 3. Message Utilities (`_shared/messageUtils.ts`)
- **Key Functions**:
  - `constructTelegramMessageUrl`: Creates shareable message links

#### 4. Database Operations (`_shared/databaseOperations.ts`)
- Now refactored into local `telegram-webhook/dbOperations.ts` for direct access
- **Key Functions**:
  - `logMessageEvent`: Logs processing events to audit trail
  - `xdelo_logProcessingEvent`: Simplified wrapper for compatibility

#### 5. CORS Handling (`_shared/cors.ts`)
- **Exports**:
  - `corsHeaders`: Standard CORS headers for all responses

#### 6. Supabase Client (`_shared/supabase.ts`)
- **Exports**:
  - `supabaseClient`: Configured client for database operations

### Message Handler Components

#### 1. Media Message Handler (`telegram-webhook/handlers/mediaMessageHandler.ts`)
- **Main Functions**:
  - `handleMediaMessage`: Entry point for all media messages
  - `xdelo_handleNewMediaMessage`: Processes new media
  - `xdelo_handleEditedMediaMessage`: Processes edited media

#### 2. Text Message Handler (`telegram-webhook/handlers/textMessageHandler.ts`)
- Handles non-media messages (text, commands, etc.)

#### 3. Edited Message Handler (`telegram-webhook/handlers/editedMessageHandler.ts`)
- Specialized handling for edit operations

### Database Operations in Webhook Function (`telegram-webhook/dbOperations.ts`)
- **Key Functions**:
  - `createMessage`: Creates new message records
  - `checkDuplicateFile`: Checks for duplicate messages
  - `logMessageEvent`: Logs events to unified_audit_logs table
  - `xdelo_logProcessingEvent`: Simplified wrapper for logMessageEvent that matches the shared component signature

### Type Definitions

#### 1. Webhook Types (`telegram-webhook/types.ts`)
- `TelegramMessage`: Message structure from Telegram API
- `MessageContext`: Context for processing (correlationId, isEdit, etc.)
- `ForwardInfo`: Structure for forwarded message metadata
- `MessageInput`: Structure for database operations

## Data Flow

### Component Relationships

```
telegram-webhook/index.ts
├── dbOperations.ts (event logging, message creation and querying)
├── handlers/mediaMessageHandler.ts
│   ├── _shared/supabase.ts
│   ├── _shared/cors.ts
│   ├── _shared/mediaUtils.ts
│   ├── _shared/mediaStorage.ts
│   ├── _shared/messageUtils.ts
│   └── types.ts
├── handlers/textMessageHandler.ts
└── handlers/editedMessageHandler.ts
```

### Media Processing Flow

1. **Request Received**
   - Telegram sends webhook to `telegram-webhook/index.ts`
   - Message type detection and context creation
   - Route to appropriate handler

2. **Media Message Handling**
   - `handleMediaMessage` function in `mediaMessageHandler.ts`
   - Branch based on whether it's a new or edited message

3. **New Media Processing**
   - Check for duplicates with `checkDuplicateFile`
   - Get message URL with `constructTelegramMessageUrl`
   - Extract media file (photo, video, document)
   - Process media with `xdelo_processMessageMedia`:
     - Download from Telegram with `xdelo_downloadMediaFromTelegram`
     - Upload to storage with `xdelo_uploadMediaToStorage`
     - Detect MIME type with `xdelo_detectMimeType`
   - Create message record with `createMessage`
   - Trigger database functions for further processing

4. **Edited Media Processing**
   - Lookup existing message in database
   - Update edit history
   - Detect changes (media or caption)
   - If media changed:
     - Process new media file
     - Update message record with new media info
   - If caption changed:
     - Update caption
     - Set processing_state to 'pending'
   - If no changes:
     - Just update edit metadata

5. **Database Trigger Chain**
   - `set_public_url` generates public URLs
   - `trg_set_file_id_expiration` sets expiration for file IDs
   - `trg_update_media_dimensions` extracts dimensions
   - Forward-related triggers if applicable
   - Caption processing triggers if applicable
   - Media group synchronization if applicable

6. **Webhook Notifications**
   - `make-update-new` trigger sends webhook to Make.com
   - `n8n-webhook` trigger sends webhook to n8n

7. **Response** 
   - Return success/error with correlation ID
   - Include CORS headers

### Media Types Handling

#### Photos
- Takes the largest photo in the array (`message.photo[message.photo.length - 1]`)
- Stores dimensions (width, height)

#### Videos
- Uses the video object directly
- Stores dimensions (width, height) and duration

#### Documents
- Uses the document object directly
- Detects MIME type
- Stores file size

### Special Cases

#### Media Groups (Albums)
- Messages with the same `media_group_id` are linked
- Captions are synchronized across the group
- Only one message (with `is_original_caption = true`) stores the actual caption

#### Forwarded Messages
- Metadata about original source stored in `forward_info`
- Special handling via `xdelo_trg_forward_media` trigger
- Tracking of forward chain

#### Message Edits
- Full edit history maintained
- Previous analyzed content preserved
- Reprocessing triggered when needed

## Processing States

- `initialized`: Media received but not yet processed
- `pending`: Ready for caption analysis
- `processing`: Currently being analyzed
- `completed`: Successfully processed
- `error`: Failed processing
- `partial_success`: Some parts processed successfully

## Audit Trail

All significant events are logged to `unified_audit_logs` table via `xdelo_logProcessingEvent`:
- Message creation
- Media processing
- Caption changes
- Errors
- Edits and forwards

This comprehensive system ensures reliable handling of all types of Telegram media with full traceability.

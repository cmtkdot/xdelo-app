# Core PostgreSQL Functions

This document describes the most important PostgreSQL functions used in the Telegram webhook processing flow. These functions are critical for message handling, media processing, and data consistency.

## Table of Contents

1. [upsert_media_message](#upsert_media_message)
2. [upsert_text_message](#upsert_text_message)
3. [sync_media_group_captions](#sync_media_group_captions)
4. [align_caption_and_analyzed_content](#align_caption_and_analyzed_content)
5. [trigger_sync_media_group_captions](#trigger_sync_media_group_captions)

## upsert_media_message

```sql
upsert_media_message(
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
```

### Description

This function handles inserting or updating media messages in the database. It provides sophisticated handling for duplicate media messages, caption changes, and media group synchronization.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| p_telegram_message_id | BIGINT | Telegram's message ID |
| p_chat_id | BIGINT | Telegram's chat ID |
| p_file_unique_id | TEXT | **Critical**: Unique identifier for the file from Telegram (NOT derived from storage path) |
| p_file_id | TEXT | File ID from Telegram (used for downloading) |
| p_storage_path | TEXT | Path where the file is stored locally |
| p_public_url | TEXT | Public URL for accessing the file |
| p_mime_type | TEXT | MIME type of the media file |
| p_extension | TEXT | File extension |
| p_media_type | TEXT | Type of media (photo, video, document, etc.) |
| p_caption | TEXT | Caption text for the media |
| p_processing_state | TEXT | Current processing state (initialized, pending, processing, etc.) |
| p_message_data | JSONB | Complete Telegram message object |
| p_correlation_id | TEXT | Unique ID for tracking the request through the system |
| p_user_id | BIGINT | Optional user ID (default: NULL) |
| p_media_group_id | TEXT | Group ID for grouped media messages (default: NULL) |
| p_forward_info | JSONB | Information about forwarded messages in standardized format (default: NULL) |
| p_processing_error | TEXT | Error message if processing failed (default: NULL) |
| p_caption_data | JSONB | Structured data extracted from caption (default: NULL) |
| p_old_analyzed_content | JSONB[] | Array of previous analyzed_content values for history tracking (default: NULL). Must be formatted as a valid PostgreSQL array (`'{}'` for empty, `'{"json":"obj1", "json":"obj2"}'` for populated) |
| p_analyzed_content | JSONB | Current analyzed content from the caption (default: NULL) |

### Returns

UUID of the inserted or updated message record.

### Key Behaviors

1. **Duplicate Detection**:
   - Identifies duplicates by `file_unique_id` and handles them appropriately
   - Preserves message history when captions change on duplicates

2. **Caption Change Handling**:
   - Detects when a message with the same `file_unique_id` has a different caption
   - Moves current `analyzed_content` to `old_analyzed_content` array
   - Resets processing state to trigger reanalysis of the new caption
   - Creates a history of all previous caption analyses in the `old_analyzed_content` JSONB array

3. **Forward Message Handling**:
   - Standardized processing of forwarded messages
   - Properly extracts metadata from the `forward_info` JSONB

4. **Audit Logging**:
   - Records all operations to `unified_audit_logs` table
   - Includes detailed metadata about the operation

### JSONB Array Handling

The `p_old_analyzed_content` parameter requires special handling when passed from TypeScript/JavaScript:

1. **Empty Arrays**:
   - PostgreSQL expects `'{}'` (not `'[]'`) for empty arrays
   - JavaScript's `[]` must be converted to PostgreSQL's `'{}'`

2. **Populated Arrays**:
   - Each element must be a valid JSONB object
   - Format: `'{"json_obj1", "json_obj2"}'`
   - Double quotes inside array elements must be properly escaped

3. **Type Conversion**:
   - TypeScript arrays must be properly formatted before being passed to the database
   - Use the `formatPostgresArray` utility function in TypeScript for proper conversion

### Example

```sql
SELECT * FROM public.upsert_media_message(
  123456789, -- p_telegram_message_id
  -100123456789, -- p_chat_id
  'ABCdef123', -- p_file_unique_id
  'BAaz-qwerty123456', -- p_file_id
  'media/ABCdef123.jpg', -- p_storage_path
  'https://example.com/media/ABCdef123.jpg', -- p_public_url
  'image/jpeg', -- p_mime_type
  'jpg', -- p_extension
  'photo', -- p_media_type
  'Sample media caption #tag', -- p_caption
  'initialized', -- p_processing_state
  '{"message_id": 123456789, "chat": {"id": -100123456789, "type": "supergroup"}}', -- p_message_data
  'corr-123456789', -- p_correlation_id
  NULL, -- p_user_id
  'media_group_123456789', -- p_media_group_id
  NULL, -- p_forward_info
  NULL, -- p_processing_error
  '{"text": "Sample media caption #tag", "tags": ["tag"]}', -- p_caption_data
  NULL, -- p_old_analyzed_content
  '{"text": "Sample media caption #tag", "tags": ["tag"], "processed": true}' -- p_analyzed_content
);
```

## upsert_text_message

```sql
upsert_text_message(
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
```

### Description

This function handles inserting or updating text messages in the database. It provides consistent handling with media messages, including forward handling and edit history.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| p_telegram_message_id | BIGINT | Telegram's message ID |
| p_chat_id | BIGINT | Telegram's chat ID |
| p_message_text | TEXT | Text content of the message |
| p_message_data | JSONB | Complete Telegram message object |
| p_correlation_id | TEXT | Unique ID for tracking the request through the system |
| p_chat_type | TEXT | Type of chat (private, group, supergroup, channel) (default: NULL) |
| p_chat_title | TEXT | Title of chat (name or group name) (default: NULL) |
| p_forward_info | JSONB | Information about forwarded messages in standardized format (default: NULL) |
| p_processing_state | TEXT | Current processing state (default: 'pending_analysis') |
| p_processing_error | TEXT | Error message if processing failed (default: NULL) |

### Returns

UUID of the inserted or updated message record.

### Key Behaviors

1. **Message Update Detection**:
   - Identifies existing messages by `telegram_message_id` and `chat_id`
   - Updates message content while preserving history

2. **Forward Message Handling**:
   - Uses the same standardized format as media messages
   - Properly extracts and stores forward metadata

3. **Enum Validation**:
   - Validates chat_type against the telegram_chat_type enum
   - Validates processing_state against the processing_state_type enum

4. **Audit Logging**:
   - Records all operations to `unified_audit_logs` table
   - Includes detailed metadata about the operation

### Example

```sql
SELECT * FROM public.upsert_text_message(
  123456789, -- p_telegram_message_id
  -100123456789, -- p_chat_id
  'This is a text message', -- p_message_text
  '{"message_id": 123456789, "chat": {"id": -100123456789, "type": "supergroup"}}', -- p_message_data
  'corr-123456789', -- p_correlation_id
  'supergroup', -- p_chat_type
  'My Super Group', -- p_chat_title
  '{"date": 1618047123, "from_chat_id": -100987654321, "from_message_id": 12345}', -- p_forward_info
  'initialized', -- p_processing_state
  NULL -- p_processing_error
);
```

## sync_media_group_captions

```sql
sync_media_group_captions(
  p_media_group_id TEXT,
  p_exclude_message_id TEXT DEFAULT NULL::text,
  p_caption TEXT DEFAULT NULL::text,
  p_caption_data JSONB DEFAULT NULL::jsonb,
  p_processing_state processing_state_type DEFAULT 'pending_analysis'::processing_state_type
) RETURNS text[]
```

### Description

This function synchronizes captions across all messages in a media group. When a caption is updated on one message in a group, this function ensures all other messages in the same group have consistent captions. It is designed to be resilient to null parameters.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| p_media_group_id | TEXT | The media group ID to synchronize (only required non-null parameter) |
| p_exclude_message_id | TEXT | Message ID to exclude from synchronization (typically the source message, can be null) |
| p_caption | TEXT | Caption text to apply to all messages in the group (defaults to empty string if null) |
| p_caption_data | JSONB | Structured caption data to apply to all messages (defaults to empty JSON if null) |
| p_processing_state | processing_state_type | Processing state to set for updated messages (default: 'pending_analysis') |

### Returns

An array of text IDs for all messages that were updated during synchronization.

### Null Parameter Handling

The function has been designed to be permissive with null parameters:
- Only `p_media_group_id` is required; the function will exit early if this is null
- All other parameters have sensible defaults if null is provided
- Uses COALESCE to provide defaults for null parameters

### Error Handling

The function includes enhanced error handling:
- Individual message update failures are caught and logged
- Processing continues even if some message updates fail
- A status variable tracks overall success/partial failure

### Security

This function uses SECURITY DEFINER to ensure it has the necessary permissions to update messages regardless of the calling user's permissions.

### Example

```sql
SELECT * FROM public.sync_media_group_captions(
  'media_group_123456789', -- p_media_group_id
  'a1b2c3d4-e5f6-...', -- p_exclude_message_id (can be null)
  'Updated caption for all media in group', -- p_caption (can be null)
  '{"text": "Updated caption for all media in group"}', -- p_caption_data (can be null)
  'pending_analysis' -- p_processing_state (has default value)
);
```

## align_caption_and_analyzed_content

```sql
align_caption_and_analyzed_content() RETURNS INTEGER
```

### Description

This utility function ensures consistency between the `caption_data` and `analyzed_content` fields in the messages table. It's useful for maintaining data integrity and fixing misaligned records.

### Behavior

1. Updates records where `caption_data` exists but `analyzed_content` is NULL
2. Updates records where `analyzed_content` exists but `caption_data` is NULL
3. Intelligently converts between text and JSONB formats
4. Logs all operations to the `unified_audit_logs` table

### Returns

The total number of records that were updated.

### Example

```sql
SELECT * FROM public.align_caption_and_analyzed_content();
```

## trigger_sync_media_group_captions

```sql
trigger_sync_media_group_captions() RETURNS TRIGGER
```

### Description

This trigger function automatically synchronizes captions across all messages in a media group when a caption is changed. It implements safeguards to prevent infinite recursion and handles errors gracefully.

### Trigger Definition

```sql
CREATE TRIGGER trigger_sync_media_group_captions
AFTER INSERT OR UPDATE OF analyzed_content, caption ON public.messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL)
EXECUTE FUNCTION public.trigger_sync_media_group_captions();
```

### Key Behaviors

1. **Recursion Prevention**:
   - Uses transaction-level variables to prevent infinite loops

2. **Change Detection**:
   - Determines if synchronization is needed based on changes to caption or analyzed_content

3. **Synchronization**:
   - Calls the `sync_media_group_captions` function to update all messages in the group

4. **Audit Logging**:
   - Records all operations and errors to the `unified_audit_logs` table

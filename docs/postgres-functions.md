# PostgreSQL Database Functions Documentation

These database functions handle the core operations for the Telegram message processing flow, particularly for message captions and media group synchronization. Each function is documented with its purpose, parameters, return values, and usage examples.

## Table of Contents
1. [upsert_media_message](#upsert_media_message)
2. [update_message_analyzed_content](#update_message_analyzed_content)
3. [xdelo_sync_media_group](#xdelo_sync_media_group)
4. [upsert_text_message](#upsert_text_message)
5. [update_message_edit_history](#update_message_edit_history)
6. [align_caption_and_analyzed_content](#align_caption_and_analyzed_content)
7. [sync_caption_fields_trigger](#sync_caption_fields_trigger)
8. [sync_media_group_captions](#sync_media_group_captions)
9. [trigger_sync_media_group_captions](#trigger_sync_media_group_captions)
10. [prevent_unnecessary_message_updates](#prevent_unnecessary_message_updates)
11. [should_sync_media_group](#should_sync_media_group)
12. [find_inconsistent_media_groups](#find_inconsistent_media_groups)

---

## upsert_media_message

```typescript
/**
 * Upserts a media message record in the database with enhanced caption change handling
 * 
 * This function creates or updates a media message record in the 'messages' table.
 * It handles various types of media including photos, videos, documents, etc.
 * The function includes specialized handling for caption changes in duplicate messages,
 * preserving analysis history and properly managing caption updates across media groups.
 * 
 * IMPORTANT: Parameter order matters when using positional parameters in SQL calls.
 * When using RPC calls from TypeScript, parameter names must match exactly.
 * 
 * @param {BIGINT} p_telegram_message_id - Telegram message ID
 * @param {BIGINT} p_chat_id - Telegram chat ID
 * @param {TEXT} p_file_unique_id - Unique file ID from Telegram (primary duplicate detection key)
 * @param {TEXT} p_file_id - Telegram file ID for the media
 * @param {TEXT} p_storage_path - Storage path where the file is saved
 * @param {TEXT} p_public_url - Public URL to access the file
 * @param {TEXT} p_mime_type - MIME type of the media
 * @param {TEXT} p_extension - File extension
 * @param {TEXT} p_media_type - Type of media (photo, video, document, etc.)
 * @param {TEXT} p_caption - Media caption text
 * @param {TEXT} p_processing_state - Processing state (initialized, pending, processed, etc.)
 * @param {JSONB} p_message_data - Complete Telegram message data
 * @param {TEXT} p_correlation_id - Correlation ID for tracking requests
 * @param {BIGINT} p_user_id - User ID (optional, default: NULL)
 * @param {TEXT} p_media_group_id - Media group ID (optional, default: NULL)
 * @param {JSONB} p_forward_info - Forward information (optional, default: NULL)
 * @param {TEXT} p_processing_error - Processing error message (optional, default: NULL)
 * @param {JSONB} p_caption_data - Processed caption data (optional, default: NULL)
 * @returns {UUID} - The ID of the created or updated message record
 * 
 * @important_notes
 * - The current database function does NOT have parameters for p_old_analyzed_content and p_analyzed_content
 * - When using this function from TypeScript, pass analyzed_content in the p_caption_data parameter
 * - Analyzed content handling is managed internally in the function
 * 
 * @behavior_notes
 * - When a caption changes in a duplicate message (same file_unique_id), the function:
 *   1. Detects the caption change
 *   2. Moves existing analyzed_content to old_analyzed_content array
 *   3. Updates the caption and related fields
 *   4. Resets processing_state to trigger reprocessing
 * - The function handles both new insertions and updates to existing records
 * - Media groups are properly maintained with consistent caption data
 * - Forward information handling is standardized across media and text messages
 * 
 * @example
 * -- Basic usage:
 * SELECT * FROM public.upsert_media_message(
 *   123456789, -- p_telegram_message_id
 *   987654321, -- p_chat_id
 *   'AQADfg4xG-9H-Unm', -- p_file_unique_id
 *   'AgACAgQAAxkBAAI6K2Yqn9R9AAGxZvs_QVMfPtO7dzTKtAAC_AIAAo1ZAAFSgJ-XYjEGNTQwBA', -- p_file_id
 *   'media/photos/AQADfg4xG-9H-Unm.jpg', -- p_storage_path
 *   'https://example.com/storage/media/photos/AQADfg4xG-9H-Unm.jpg', -- p_public_url
 *   'image/jpeg', -- p_mime_type
 *   'jpg', -- p_extension
 *   'photo', -- p_media_type
 *   'Beautiful sunset!', -- p_caption
 *   'initialized', -- p_processing_state
 *   '{"message_id": 123456789, "chat": {"id": 987654321, "type": "private"}}', -- p_message_data
 *   'corr-abc-123', -- p_correlation_id
 *   NULL, -- p_user_id
 *   'BAACAgIAAxkDAAIC_GXlb00qJCLUXS6MB3xAJehCmPl-AAL7RAACiqc4Swo7HF5S5rCDMwQ', -- p_media_group_id
 *   NULL, -- p_forward_info
 *   NULL, -- p_processing_error
 *   '{"parsed_entities": [{"type": "hashtag", "text": "#sunset"}]}' -- p_caption_data
 * );
 * 
 * -- With caption change (updating existing record):
 * SELECT * FROM public.upsert_media_message(
 *   123456789, -- p_telegram_message_id
 *   987654321, -- p_chat_id
 *   'AQADfg4xG-9H-Unm', -- p_file_unique_id (existing record)
 *   'AgACAgQAAxkBAAI6K2Yqn9R9AAGxZvs_QVMfPtO7dzTKtAAC_AIAAo1ZAAFSgJ-XYjEGNTQwBA', -- p_file_id
 *   'media/photos/AQADfg4xG-9H-Unm.jpg', -- p_storage_path
 *   'https://example.com/storage/media/photos/AQADfg4xG-9H-Unm.jpg', -- p_public_url
 *   'image/jpeg', -- p_mime_type
 *   'jpg', -- p_extension
 *   'photo', -- p_media_type
 *   'Beautiful sunset at the beach! #vacation', -- p_caption (changed)
 *   'initialized', -- p_processing_state
 *   '{"message_id": 123456789, "chat": {"id": 987654321, "type": "private"}}', -- p_message_data
 *   'corr-abc-124', -- p_correlation_id
 *   NULL, -- p_user_id
 *   'BAACAgIAAxkDAAIC_GXlb00qJCLUXS6MB3xAJehCmPl-AAL7RAACiqc4Swo7HF5S5rCDMwQ', -- p_media_group_id
 *   NULL, -- p_forward_info
 *   NULL, -- p_processing_error
 *   '{"parsed_entities": [{"type": "hashtag", "text": "#sunset"}, {"type": "hashtag", "text": "#vacation"}]}', -- p_caption_data
 *   NULL, -- p_old_analyzed_content (function will automatically move current analyzed_content here)
 *   NULL -- p_analyzed_content (will use p_caption_data if NULL)
 * );
 */
```

### TypeScript Interface

```typescript
/**
 * Input parameters for upserting a media message record in the messages table.
 * 
 * Note: The PostgreSQL function extracts certain fields (like message_date, chat_type,
 * and chat_title) directly from the messageData, so we don't need to provide these separately.
 * 
 * @interface UpsertMediaMessageParams
 */
export interface UpsertMediaMessageParams {
  /** Supabase client for database operations */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Chat ID where the message was sent */
  chatId: number;
  /** Caption of the media */
  caption?: string | null;
  /** Media type (photo, video, document, audio, etc.) */
  mediaType?: string | null;
  /** File ID from Telegram */
  fileId?: string | null;
  /** Unique file ID from Telegram */
  fileUniqueId?: string | null;
  /** Path where the file is stored */
  storagePath?: string | null;
  /** Public URL of the file */
  publicUrl?: string | null;
  /** MIME type of the file */
  mimeType?: string | null;
  /** File extension */
  extension?: string | null;
  /** Complete Telegram message data */
  messageData: Json;
  /** Current processing state */
  processingState: ProcessingState;
  /** Error message if processing failed */
  processingError?: string | null;
  /** Forward information if message is forwarded */
  forwardInfo?: ForwardInfo | null;
  /** Media group ID if message is part of a media group */
  mediaGroupId?: string | null;
  /** Processed caption data structure (synchronized with analyzed_content) */
  captionData?: Json | null;
  /** Analyzed content from caption parsing (synchronized with caption_data) */
  analyzedContent?: Json | null;
  /** Additional updates to apply during upsert (e.g., old_analyzed_content) */
  additionalUpdates?: Record<string, any>;
  /** Correlation ID for request tracking */
  correlationId: string;
}
```

## update_message_analyzed_content

```typescript
/**
 * Updates the analyzed content for a message
 * 
 * This function updates the analyzed_content field for a message, archiving
 * the previous content to old_analyzed_content when appropriate.
 * 
 * @param {UUID} p_message_id - ID of the message to update
 * @param {JSONB} p_analyzed_content - New analyzed content data
 * @param {public.processing_state_type} p_processing_state - New processing state (optional)
 * @returns {UUID} - The ID of the updated message
 * 
 * @example
 * SELECT * FROM public.update_message_analyzed_content(
 *   'a1b2c3d4-e5f6-...',
 *   '{"parsed": {"entities": [{"type": "mention", "text": "@username"}]}}',
 *   'processed'
 * );
 */
```

## xdelo_sync_media_group

```typescript
/**
 * Synchronizes caption and analyzed content across a media group
 * 
 * This function ensures all messages in a media group share the same caption,
 * caption_data, and relevant metadata. It copies values from a source message
 * to all other messages in the group.
 * 
 * @param {TEXT} p_media_group_id - Media group ID to synchronize
 * @param {UUID} p_source_message_id - Source message ID to copy data from
 * @param {BOOLEAN} p_is_api_triggered - Whether this was triggered via API
 * @returns {INTEGER} - Number of messages updated
 * 
 * @example
 * SELECT * FROM public.xdelo_sync_media_group(
 *   'media_group_123',
 *   'a1b2c3d4-e5f6-...',
 *   true
 * );
 */
```

## upsert_text_message

```typescript
/**
 * Upserts a text message record in the 'other_messages' table
 * 
 * This function creates or updates a text message record, handling various
 * message attributes and forward information.
 * 
 * IMPORTANT: Parameter order matters when using positional parameters in SQL calls.
 * When using RPC calls from TypeScript, parameter names must match exactly.
 * 
 * @param {BIGINT} p_telegram_message_id - Telegram message ID
 * @param {BIGINT} p_chat_id - Telegram chat ID
 * @param {TEXT} p_message_text - Text content of the message
 * @param {JSONB} p_message_data - Complete Telegram message data JSON
 * @param {TEXT} p_correlation_id - Correlation ID for tracking requests - CRITICAL: this is the 5th parameter
 * @param {TEXT} p_chat_type - Type of chat (private, group, etc.) (optional)
 * @param {TEXT} p_chat_title - Title of the chat (optional)
 * @param {JSONB} p_forward_info - Forward information (optional)
 * @param {TEXT} p_processing_state - Processing state (default: 'pending_analysis')
 * @param {TEXT} p_processing_error - Processing error message (optional)
 * @returns {UUID} - The ID of the created or updated message record
 * 
 * @example
 * SELECT * FROM public.upsert_text_message(
 *   123456789, -- telegram_message_id
 *   987654321, -- chat_id
 *   'Hello, world!', -- message_text
 *   '{"message_id": 123456789, "chat": {"id": 987654321}}', -- message_data
 *   'corr-123', -- correlation_id
 *   'private', -- chat_type
 *   'Chat Title', -- chat_title
 *   '{"from_chat_id": 123, "date": "2023-01-01"}', -- forward_info
 *   'pending_analysis', -- processing_state
 *   NULL -- processing_error
 * );
 */
```

## update_message_edit_history

```typescript
/**
 * Updates message edit history and handles content changes
 * 
 * This function manages the edit history for messages, including:
 * 1. Archiving previous message content
 * 2. Updating the message with new content
 * 3. Marking the message as edited
 * 4. Updating edit history timestamps
 * 
 * @param {UUID} p_message_id - ID of the message to update
 * @param {TEXT} p_caption - New caption text
 * @param {TEXT} p_message_text - New message text (for text messages)
 * @param {JSONB} p_message_data - Updated Telegram message data
 * @param {public.processing_state_type} p_processing_state - New processing state
 * @returns {UUID} - The ID of the updated message
 * 
 * @example
 * -- For a media message with caption:
 * SELECT * FROM public.update_message_edit_history(
 *   'a1b2c3d4-e5f6-...',
 *   'Updated caption',
 *   NULL,
 *   '{"message_id": 123456789, "edit_date": 1609459200}',
 *   'pending_analysis'
 * );
 * 
 * -- For a text message:
 * SELECT * FROM public.update_message_edit_history(
 *   'a1b2c3d4-e5f6-...',
 *   NULL,
 *   'Updated text content',
 *   '{"message_id": 123456789, "edit_date": 1609459200}',
 *   'pending_analysis'
 * );
 */
```

## align_caption_and_analyzed_content

```typescript
/**
 * Ensures caption_data and analyzed_content fields are synchronized
 * 
 * This function checks if both fields exist and copies data between them
 * to ensure they are synchronized when one is updated without the other.
 * 
 * @param {UUID} p_message_id - ID of the message to update
 * @returns {UUID} - The ID of the updated message
 * 
 * @example
 * SELECT * FROM public.align_caption_and_analyzed_content(
 *   'a1b2c3d4-e5f6-...'
 * );
 */
```

## sync_caption_fields_trigger

```typescript
/**
 * Trigger function to maintain caption_data and analyzed_content field synchronization
 * 
 * This trigger function fires BEFORE UPDATE on the messages table and ensures
 * that both caption_data and analyzed_content fields stay synchronized. It handles:
 * 1. When caption_data is updated but analyzed_content is not, it updates analyzed_content
 * 2. When analyzed_content is updated but caption_data is not, it updates caption_data
 * 
 * @trigger BEFORE UPDATE ON public.messages FOR EACH ROW
 * 
 * @param {trigger} - Standard trigger parameters (NEW and OLD row values)
 * @returns {trigger} - Modified NEW row with synchronized fields
 * 
 * @example
 * -- This trigger runs automatically on any update to the messages table
 * -- For instance, when manually updating only one field:
 * 
 * UPDATE messages
 * SET caption_data = '{"parsed": "new data"}'
 * WHERE id = 'some-uuid';
 * 
 * -- The trigger will automatically ensure analyzed_content is also updated
 * -- to maintain field synchronization
 */
```

## sync_media_group_captions

```typescript
/**
 * Synchronizes captions and analyzed content across all messages in a media group
 * 
 * This function updates captions and analyzed content for all messages in the same
 * media group (except for the one that triggered the sync). It also handles archiving
 * previous analyzed content to old_analyzed_content when updates occur.
 * 
 * Key operations performed:
 * 1. Archives existing analyzed_content to old_analyzed_content array
 * 2. Updates caption and analyzed_content fields to match source message
 * 3. Updates processing_state to trigger appropriate workflows
 * 4. Marks messages as edited and updates timestamps
 * 5. Returns UUIDs of all updated messages
 *
 * @param {TEXT} p_media_group_id - Media group ID to synchronize
 * @param {TEXT} p_exclude_message_id - Message ID to exclude from updates
 * @param {TEXT} p_caption - New caption to apply to all group messages
 * @param {JSONB} p_caption_data - New analyzed content data to apply
 * @param {public.processing_state_type} p_processing_state - Processing state to set (defaults to 'pending_analysis')
 * @returns {SETOF UUID} Array of message IDs that were updated
 * 
 * @example
 * -- Sync all related messages with a new caption and analyzed content
 * SELECT * FROM public.sync_media_group_captions(
 *   'media_group_123',
 *   'a1b2c3d4-e5f6-...',
 *   'New shared caption',
 *   '{"parsed": {"tags": ["travel", "nature"]}}',
 *   'pending_analysis'
 * );
 */
```

## trigger_sync_media_group_captions

```typescript
/**
 * Trigger function that automatically synchronizes media group messages
 * 
 * This trigger fires AFTER INSERT or UPDATE on the messages table when
 * analyzed_content or caption changes on a message with a media_group_id.
 * It ensures all messages in the same group have consistent content.
 * 
 * The function implements safeguards to prevent infinite recursion
 * and logs all operations to the audit_logs table with detailed metadata.
 * 
 * Key operations:
 * 1. Detects relevant changes to caption or analyzed_content
 * 2. Calls sync_media_group_captions function with appropriate parameters
 * 3. Records sync operations in audit_logs for monitoring
 * 4. Handles errors gracefully without failing the transaction
 * 
 * @trigger AFTER INSERT OR UPDATE OF analyzed_content, caption ON public.messages
 * @condition NEW.media_group_id IS NOT NULL
 * 
 * @example
 * -- This trigger runs automatically on any relevant update
 * -- For instance, when manually updating a caption:
 * 
 * UPDATE messages
 * SET caption = 'New group caption'
 * WHERE id = 'some-uuid' AND media_group_id IS NOT NULL;
 * 
 * -- The trigger will automatically update all other messages in the group
 * -- and record the operation in audit_logs
 */
```

## prevent_unnecessary_message_updates

```typescript
/**
 * Trigger function to prevent unnecessary update cycles
 * 
 * This trigger fires BEFORE UPDATE on the messages table and checks if
 * any relevant fields have actually changed. If no changes are detected,
 * it prevents the update from proceeding, which helps avoid triggering
 * unnecessary sync operations and infinite loops.
 * 
 * Monitored fields:
 * - caption
 * - analyzed_content
 * - processing_state
 * - is_edited
 * 
 * When none of these fields change, the update is skipped entirely by
 * returning NULL instead of NEW.
 * 
 * @trigger BEFORE UPDATE ON public.messages FOR EACH ROW
 * 
 * @example
 * -- This trigger runs automatically on any update
 * -- If no relevant fields changed, the update is skipped entirely
 * 
 * UPDATE messages 
 * SET updated_at = now()
 * WHERE id = 'some-uuid' AND caption IS NOT NULL;
 * 
 * -- If only the updated_at field changed but caption and analyzed_content
 * -- remained the same, the update would be blocked to prevent unnecessary
 * -- synchronization operations
 */
```

## should_sync_media_group

```typescript
/**
 * Helper function to determine if media group sync is needed
 * 
 * This function analyzes the old and new record states to determine
 * if synchronization should occur. It checks for media_group_id existence
 * and changes to relevant fields like caption and analyzed_content.
 * 
 * Decision logic:
 * 1. Always returns false if no media_group_id exists
 * 2. For new records, checks if sufficient content exists to sync
 * 3. For updates, compares old and new values of caption and analyzed_content
 * 
 * @param {JSONB} p_old_record - Previous record state as JSONB (NULL for INSERTs)
 * @param {JSONB} p_new_record - New record state as JSONB
 * @returns {BOOLEAN} True if sync should occur, false otherwise
 * 
 * @example
 * -- Check if sync should happen for a record update
 * SELECT public.should_sync_media_group(
 *   '{"media_group_id":"123","caption":"Old caption","analyzed_content":{}}',
 *   '{"media_group_id":"123","caption":"New caption","analyzed_content":{}}'
 * );
 * -- Returns: true (because caption changed)
 * 
 * -- Check with no media group ID
 * SELECT public.should_sync_media_group(
 *   NULL,
 *   '{"caption":"New caption","analyzed_content":{}}'  
 * );
 * -- Returns: false (no media group to sync)
 */
```

## find_inconsistent_media_groups

```typescript
/**
 * Finds media groups with inconsistent analyzed_content across messages
 * 
 * This function identifies media groups where some messages have analyzed_content
 * while others don't, making them candidates for synchronization. It analyzes
 * all media groups and returns information about those most in need of fixing.
 * 
 * For each inconsistent group found, the function determines the best source
 * message to use for synchronization, prioritizing messages with:
 * 1. Non-null analyzed_content
 * 2. Valid captions
 * 3. Richer analyzed content (more entities)
 * 4. More recent updates
 * 
 * This function is primarily used by the media_group_sync_cron job to
 * automatically fix inconsistencies across media group messages.
 * 
 * @param {INTEGER} p_limit - Maximum number of media groups to return (default: 50)
 * @returns {TABLE} A table with the following columns:
 *   - media_group_id: The Telegram media group ID
 *   - message_count: Total number of messages in the group
 *   - syncable_messages: Number of messages with analyzed_content
 *   - needs_sync_messages: Number of messages missing analyzed_content
 *   - best_source_id: UUID of the best message to use as source for syncing
 * 
 * @example
 * -- Find up to 10 inconsistent media groups
 * SELECT * FROM public.find_inconsistent_media_groups(10);
 * 
 * -- Get detailed statistics for all problematic groups
 * SELECT
 *   media_group_id,
 *   message_count,
 *   syncable_messages,
 *   needs_sync_messages,
 *   best_source_id
 * FROM public.find_inconsistent_media_groups();
 */
```

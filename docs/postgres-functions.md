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

---

## upsert_media_message

```typescript
/**
 * Upserts a media message record in the database
 * 
 * This function handles both inserting new messages and updating existing ones based
 * on the telegram_message_id and chat_id combination. It manages duplicate file handling
 * and keeps track of edit history when applicable.
 * 
 * @param {number} p_telegram_message_id - Telegram message ID
 * @param {number} p_chat_id - Telegram chat ID
 * @param {string|null} p_caption - Caption text 
 * @param {string|null} p_media_type - Type of media (photo, video, document, etc.)
 * @param {string|null} p_file_id - Telegram file ID
 * @param {string|null} p_file_unique_id - Telegram unique file ID for deduplication
 * @param {string|null} p_storage_path - Storage path where file is saved
 * @param {string|null} p_public_url - Public URL to access the file
 * @param {string|null} p_mime_type - MIME type of the file
 * @param {string|null} p_extension - File extension
 * @param {jsonb} p_message_data - Complete Telegram message object
 * @param {processing_state_type} p_processing_state - Current processing state
 * @param {string|null} p_processing_error - Error message if processing failed
 * @param {jsonb|null} p_forward_info - Information about forwarded messages
 * @param {string|null} p_media_group_id - Group ID for media groups
 * @param {jsonb|null} p_caption_data - Parsed caption data
 * @param {string} p_correlation_id - Correlation ID for request tracking
 * 
 * @returns {uuid} The ID of the inserted or updated message
 * 
 * @example
 * // SQL call format
 * SELECT upsert_media_message(
 *   p_telegram_message_id := 12345,
 *   p_chat_id := 67890,
 *   p_caption := 'Photo from my vacation',
 *   p_media_type := 'photo',
 *   p_file_id := 'AgADBAADv6kxG-1fAUgQ8P4AAQNLrOVKiwAEgQ',
 *   p_file_unique_id := 'AQADkK4xG_cN6EZ-',
 *   p_storage_path := 'telegram/photos/AQADkK4xG_cN6EZ-.jpeg',
 *   p_public_url := 'https://example.com/storage/telegram/photos/AQADkK4xG_cN6EZ-.jpeg',
 *   p_mime_type := 'image/jpeg',
 *   p_extension := 'jpeg',
 *   p_message_data := '{"message_id": 12345, "chat": {"id": 67890, "type": "private"}, ...}',
 *   p_processing_state := 'processed',
 *   p_processing_error := NULL,
 *   p_forward_info := NULL,
 *   p_media_group_id := NULL,
 *   p_caption_data := NULL,
 *   p_correlation_id := 'abc-123'
 * );
 */
```

## update_message_analyzed_content

```typescript
/**
 * Updates a message's analyzed content and manages history
 * 
 * This function updates the analyzed_content field of a message and handles:
 * 1. Moving current analyzed_content to old_analyzed_content array
 * 2. Setting the new analyzed_content value
 * 3. Updating processing_state and metadata
 * 
 * @param {uuid} p_message_id - UUID of the message to update
 * @param {jsonb} p_analyzed_content - New analyzed content data
 * @param {processing_state_type} p_processing_state - New processing state
 * @param {boolean} p_preserve_history - Whether to preserve history (default true)
 * @param {string} p_correlation_id - Correlation ID for request tracking
 * 
 * @returns {jsonb} Result object with success status and message metadata
 * @returns {boolean} .success - Whether the update was successful
 * @returns {uuid} .message_id - The updated message ID
 * @returns {string|null} .media_group_id - Media group ID if applicable
 * @returns {boolean} .history_updated - Whether history was preserved
 * @returns {integer} .history_count - Number of items in history after update
 * 
 * @example
 * // Update analyzed content and reset processing state
 * SELECT update_message_analyzed_content(
 *   p_message_id := '123e4567-e89b-12d3-a456-426614174000',
 *   p_analyzed_content := '{"tags": ["vacation", "beach"], "locations": ["Hawaii"]}',
 *   p_processing_state := 'completed',
 *   p_preserve_history := true,
 *   p_correlation_id := 'abc-123'
 * );
 * 
 * // Expected result:
 * {
 *   "success": true,
 *   "message_id": "123e4567-e89b-12d3-a456-426614174000",
 *   "media_group_id": "media_group_123",
 *   "history_updated": true,
 *   "history_count": 2
 * }
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
 * @param {uuid} p_source_message_id - Source message ID to copy from
 * @param {string} p_media_group_id - Media group ID to sync
 * @param {string} p_correlation_id - Correlation ID for request tracking
 * @param {boolean} p_force_sync - Whether to force sync even if source is not original
 * @param {boolean} p_sync_edit_history - Whether to sync edit history (for edits)
 * 
 * @returns {jsonb} Result object with sync statistics
 * @returns {boolean} .success - Whether the sync was successful
 * @returns {integer} .synced_count - Number of messages synchronized
 * @returns {uuid[]} .synced_ids - Array of message IDs that were updated
 * @returns {string} .media_group_id - The media group ID that was synced
 * 
 * @example
 * // Sync a media group after caption edit
 * SELECT xdelo_sync_media_group(
 *   p_source_message_id := '123e4567-e89b-12d3-a456-426614174000',
 *   p_media_group_id := 'media_group_123',
 *   p_correlation_id := 'abc-123',
 *   p_force_sync := true,
 *   p_sync_edit_history := true
 * );
 * 
 * // Expected result:
 * {
 *   "success": true,
 *   "synced_count": 3,
 *   "synced_ids": ["uuid2", "uuid3", "uuid4"],
 *   "media_group_id": "media_group_123"
 * }
 */
```

## upsert_text_message

```typescript
/**
 * Upserts a text message record in the other_messages table
 * 
 * This function handles inserting new text messages or updating existing ones
 * based on the telegram_message_id and chat_id combination. It manages edit
 * history and properly handles forwarded messages.
 * 
 * @param {number} p_telegram_message_id - Telegram message ID
 * @param {number} p_chat_id - Telegram chat ID
 * @param {string|null} p_message_text - Text content of the message
 * @param {jsonb} p_telegram_data - Complete Telegram message object
 * @param {jsonb|null} p_forward_info - Information about forwarded messages
 * @param {string} p_correlation_id - Correlation ID for request tracking
 * 
 * @returns {uuid} The ID of the inserted or updated message
 * 
 * @example
 * // Upsert a text message
 * SELECT upsert_text_message(
 *   p_telegram_message_id := 12345,
 *   p_chat_id := 67890,
 *   p_message_text := 'Hello, this is a text message!',
 *   p_telegram_data := '{"message_id": 12345, "chat": {"id": 67890, "type": "private"}, ...}',
 *   p_forward_info := '{"from_chat_id": 54321, "date": "2025-01-01T00:00:00Z", "from_message_id": 98765}',
 *   p_correlation_id := 'abc-123'
 * );
 */
```

## update_message_edit_history

```typescript
/**
 * Updates a message's edit history when content changes
 * 
 * This function:
 * 1. Adds the current message state to the edit history array
 * 2. Updates the message with new content
 * 3. Records edit metadata (timestamp, edited fields)
 * 
 * @param {uuid} p_message_id - UUID of the message to update
 * @param {jsonb} p_message_data - Updated Telegram message object
 * @param {string|null} p_text_or_caption - New text or caption content
 * @param {boolean} p_is_caption - Whether this is a caption edit (true) or text edit (false)
 * @param {string} p_correlation_id - Correlation ID for request tracking
 * 
 * @returns {jsonb} Result object with edit history details
 * @returns {boolean} .success - Whether the update was successful
 * @returns {uuid} .message_id - The updated message ID
 * @returns {integer} .edit_count - Total number of edits after this update
 * @returns {string} .updated_field - Which field was updated ("text" or "caption")
 * 
 * @example
 * // Update a message caption with edit history tracking
 * SELECT update_message_edit_history(
 *   p_message_id := '123e4567-e89b-12d3-a456-426614174000',
 *   p_message_data := '{"message_id": 12345, "chat": {"id": 67890}, "edit_date": 1649845200, ...}',
 *   p_text_or_caption := 'Updated caption with corrections',
 *   p_is_caption := true,
 *   p_correlation_id := 'abc-123'
 * );
 * 
 * // Expected result:
 * {
 *   "success": true,
 *   "message_id": "123e4567-e89b-12d3-a456-426614174000",
 *   "edit_count": 2,
 *   "updated_field": "caption"
 * }
 */
```

## Enums and Custom Types

```typescript
/**
 * processing_state_type - Enum for message processing states
 * 
 * This enum type defines the possible states a message can be in during processing.
 * 
 * @enum {string}
 * @property {'initialized'} - Initial state when message is first created
 * @property {'pending'} - Message is queued for processing
 * @property {'processing'} - Message is currently being processed
 * @property {'processed'} - Message has been successfully processed
 * @property {'completed'} - Message processing is fully complete
 * @property {'duplicate'} - Message was identified as a duplicate
 * @property {'download_failed_forwarded'} - Download failed for a forwarded message
 * @property {'error'} - An error occurred during processing
 * 
 * @example
 * // Table definition using this type
 * CREATE TABLE messages (
 *   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   telegram_message_id bigint NOT NULL,
 *   processing_state processing_state_type NOT NULL DEFAULT 'initialized',
 *   -- other fields...
 * );
 * 
 * // Using in a function parameter
 * CREATE OR REPLACE FUNCTION update_processing_state(
 *   p_message_id uuid,
 *   p_state processing_state_type
 * ) RETURNS void AS $$
 * BEGIN
 *   UPDATE messages SET processing_state = p_state WHERE id = p_message_id;
 * END;
 * $$ LANGUAGE plpgsql;
 */
```

```typescript
/**
 * telegram_chat_type - Enum for Telegram chat types
 * 
 * This enum type defines the possible types of Telegram chats.
 * 
 * @enum {string}
 * @property {'private'} - Direct message between bot and user
 * @property {'group'} - Small group chat
 * @property {'supergroup'} - Large group chat with enhanced features
 * @property {'channel'} - Broadcast channel
 * @property {'unknown'} - Unknown chat type (fallback)
 * 
 * @example
 * // Table definition using this type
 * CREATE TABLE other_messages (
 *   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   chat_id bigint NOT NULL,
 *   chat_type telegram_chat_type NOT NULL DEFAULT 'unknown',
 *   -- other fields...
 * );
 */
```

## align_caption_and_analyzed_content

```typescript
/**
 * Retroactively aligns caption_data and analyzed_content fields in messages
 * 
 * This function scans the messages table and syncronizes data between 
 * caption_data and analyzed_content fields where they're out of sync.
 * It operates in two phases:
 * 1. Updating analyzed_content where caption_data exists but analyzed_content doesn't
 * 2. Updating caption_data where analyzed_content exists but caption_data doesn't
 * 
 * @returns {integer} Total number of records updated across both operations
 * 
 * @example
 * // Align all out-of-sync records and return count of updates
 * SELECT align_caption_and_analyzed_content();
 * 
 * // Expected result: 
 * // (console output)
 * // NOTICE: Updated 42 records with caption_data -> analyzed_content
 * // NOTICE: Updated 17 records with analyzed_content -> caption_data
 * // 
 * // (function return value)
 * // 59
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

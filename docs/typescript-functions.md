# TypeScript Database Functions Documentation

## Table of Contents

- [Message Caption Processing Flow](#message-caption-processing-flow)
- [Message Record Management](#message-record-management)
- [Caption Data and Analyzed Content Synchronization](#caption-data-and-analyzed-content-synchronization)

## Caption Data and Analyzed Content Synchronization

```typescript
/**
 * Field Relationship: caption_data and analyzed_content
 * 
 * These two fields store the same structured data extracted from message captions,
 * and are maintained in sync for consistency across the application:
 * 
 * @field {Json | null} caption_data - Structured data parsed from message captions
 * @field {Json | null} analyzed_content - Mirror of caption_data for backward compatibility
 * 
 * IMPORTANT: When updating either field, always update both with the same value.
 * 
 * Data Flow:
 * 1. When a message with a caption is created or updated:
 *    - Both caption_data and analyzed_content are set to the same value
 *    - The PostgreSQL trigger sync_caption_fields_trigger ensures they remain in sync
 * 
 * 2. When retrieving caption data, either field can be used (they should be identical)
 * 
 * 3. For media groups, when one message's caption is updated:
 *    - The syncMediaGroupCaptions function ensures all messages in the group
 *      have consistent values for both fields
 * 
 * 4. The align_caption_and_analyzed_content PostgreSQL function is available for
 *    retroactively fixing any discrepancies between these fields in existing records
 * 
 * @example
 * // Correctly updating a message with caption data
 * await updateMessageRecord({
 *   supabaseClient,
 *   messageId: 123456,
 *   chatId: 789012,
 *   caption: "New caption text",
 *   captionData: parsedCaptionData,
 *   analyzedContent: parsedCaptionData, // Same as captionData
 *   correlationId: "abc-123"
 * });
 */
```

## Message Caption Processing Flow

```typescript
/**
 * Triggers the caption parser for a message when caption content needs analysis
 * 
 * This function initiates the caption parsing process by:
 * 1. Verifying the message exists and has a caption
 * 2. Invoking the manual-caption-parser Edge Function
 * 3. Handling media group synchronization if needed
 * 
 * @param {Object} params - Function parameters
 * @param {SupabaseClient<Database>} params.supabaseClient - Initialized Supabase client
 * @param {string} params.messageId - UUID of the message to process
 * @param {string} params.correlationId - Request correlation ID for tracing
 * 
 * @returns {Promise<DbOperationResult<void>>} Operation result with success status
 * 
 * @example
 * // Trigger caption parsing for a new message
 * const result = await triggerCaptionParsing({
 *   supabaseClient,
 *   messageId: "123e4567-e89b-12d3-a456-426614174000",
 *   correlationId: "abc-123"
 * });
 * 
 * // Handle the result
 * if (result.success) {
 *   console.log("Caption parsing triggered successfully");
 * } else {
 *   console.error(`Failed to trigger caption parsing: ${result.error}`);
 * }
 */
```

## Message Record Management

```typescript
/**
 * Updates a message record in the database based on edited content
 * 
 * This function handles updates to both text and media messages, including:
 * - Caption changes
 * - Edit history tracking
 * - Processing state adjustments
 * - Media group handling
 * 
 * @param {SupabaseClient<Database>} supabaseClient - Initialized Supabase client
 * @param {MessageRecord} existingRecord - The current record from the database
 * @param {TelegramMessage} newMessage - The updated message from Telegram
 * @param {ProcessingResult | null} mediaResult - Optional media processing result
 * @param {Json | null} captionData - Optional analyzed caption data
 * @param {string} correlationId - Request correlation ID for tracing
 * 
 * @returns {Promise<boolean>} True if update was successful, false otherwise
 * 
 * @example
 * // Update a message with edited caption
 * const updateResult = await updateMessageRecord(
 *   supabaseClient,
 *   existingRecord,
 *   message,
 *   null, // No media result since we're not re-processing media
 *   null, // No caption data - will be processed by caption parser
 *   correlationId
 * );
 * 
 * if (!updateResult) {
 *   logWithCorrelation(correlationId, `Failed to update message record for edit`);
 * }
 */
```

## Media Group Synchronization

```typescript
/**
 * Syncs caption and analyzed content across all messages in a media group
 * 
 * This function ensures all related media files share the same caption data by:
 * 1. Finding all messages with the same media_group_id
 * 2. Applying the source message's caption and analyzed_content to all related messages
 * 3. Preserving edit history for each message
 * 
 * @param {SupabaseClient<Database>} supabaseClient - Initialized Supabase client
 * @param {string} mediaGroupId - The media group ID to sync
 * @param {string} excludeMessageId - Message ID to exclude (usually the source)
 * @param {string | null} caption - The caption text to apply to all messages
 * @param {Json | null} captionData - The analyzed caption data to apply
 * @param {ProcessingState} processingState - The processing state to set
 * @param {string} correlationId - Request correlation ID for tracing
 * 
 * @returns {Promise<DbOperationResult<void>>} Operation result
 * 
 * @example
 * // Sync caption data across a media group after editing one message
 * const syncResult = await syncMediaGroupCaptions(
 *   supabaseClient,
 *   "12345678", // media_group_id
 *   "abc-123",  // source message ID to exclude
 *   "Updated caption for all files", // new caption
 *   { parsed_data: {...} }, // analyzed caption data
 *   "initialized", // reset processing state to trigger reanalysis
 *   correlationId
 * );
 * 
 * if (!syncResult.success) {
 *   logWithCorrelation(correlationId, `Media group sync failed: ${syncResult.error}`);
 * }
 */
```

## Caption Analysis and Storage

```typescript
/**
 * Analyzes and stores structured data extracted from message captions
 * 
 * This function is implemented in the manual-caption-parser Edge Function:
 * 1. Parses the caption using xdelo_parseCaption
 * 2. Stores the structured data in the analyzed_content field
 * 3. Updates the message processing state
 * 4. Handles media group synchronization if needed
 * 
 * @param {Object} request - The caption analysis request
 * @param {string} request.messageId - UUID of the message to analyze
 * @param {string} [request.caption] - Optional caption text override
 * @param {boolean} [request.isEdit] - Whether this is from an edit operation
 * @param {string} [request.correlationId] - Request correlation ID for tracing
 * 
 * @returns {Promise<Object>} Analysis results with success status
 * @returns {boolean} .success - Whether the operation succeeded
 * @returns {string} .message_id - The processed message ID
 * @returns {boolean} .analyzed - Whether analysis was performed
 * @returns {number} .caption_length - Length of the analyzed caption
 * @returns {boolean} .has_media_group - Whether the message belongs to a group
 * @returns {string} [.media_group_id] - The media group ID if applicable
 * @returns {boolean} .media_group_synced - Whether group sync was performed
 * @returns {number} .synced_count - Number of messages synchronized
 * 
 * @example
 * // Basic caption analysis
 * const result = await handleCaptionParsing({
 *   messageId: "123e4567-e89b-12d3-a456-426614174000",
 *   correlationId: "abc-123"
 * });
 * 
 * console.log(`Analyzed caption (${result.caption_length} chars)`);
 * if (result.has_media_group) {
 *   console.log(`Synced with ${result.synced_count} other messages`);
 * }
 */
```

## Message Lookup Functions

```typescript
/**
 * Finds a message record by its Telegram message ID and chat ID
 * 
 * This function is critical for the edit flow as it locates the existing message
 * record that needs to be updated with new caption or content.
 * 
 * @param {SupabaseClient<Database>} supabaseClient - Initialized Supabase client
 * @param {number} telegramMessageId - The Telegram message ID
 * @param {number} chatId - The chat ID where the message exists
 * @param {string} correlationId - Request correlation ID for tracing
 * 
 * @returns {Promise<DbOperationResult<MessageRecord | null>>} Operation result with the found message
 * 
 * @example
 * // Find the original message to update
 * const findResult = await findMessageByTelegramId(
 *   supabaseClient,
 *   message.message_id,
 *   message.chat.id,
 *   correlationId
 * );
 * 
 * if (!findResult.success) {
 *   console.error(`Error finding message to edit: ${findResult.error}`);
 *   return;
 * }
 * 
 * if (!findResult.data) {
 *   console.warn(`Original message not found for edit`);
 *   return;
 * }
 * 
 * const existingRecord = findResult.data;
 * // Proceed with updating the record
 */
```

## Upsert Media Message

```typescript
/**
 * Upserts a media message record in the database using the PostgreSQL function
 * 
 * This handles the duplicate file_unique_id constraint by updating the existing record
 * if a message with the same file_unique_id already exists. Special handling is implemented
 * for caption changes in duplicate messages to preserve analysis history.
 * 
 * IMPORTANT: This function has been aligned with the PostgreSQL upsert_media_message function's
 * parameter order and naming. When using RPC calls, parameter names must match exactly.
 * 
 * @param {Object} params - Function parameters
 * @param {SupabaseClient<Database>} params.supabaseClient - Initialized Supabase client
 * @param {number} params.messageId - Telegram message ID
 * @param {number} params.chatId - Chat ID
 * @param {string} params.fileUniqueId - Unique file ID from Telegram (critical for duplicate detection)
 * @param {string} params.fileId - File ID from Telegram
 * @param {string} params.storagePath - Storage path where the file is saved
 * @param {string} params.publicUrl - Public URL to access the file
 * @param {string} params.mimeType - MIME type of the media
 * @param {string} params.extension - File extension
 * @param {string} params.mediaType - Type of media (photo, video, document, etc.)
 * @param {Json} params.messageData - Complete Telegram message data
 * @param {string} [params.caption] - Media caption text
 * @param {string} [params.processingState] - Processing state
 * @param {string} [params.processingError] - Error message if processing failed
 * @param {ForwardInfo} [params.forwardInfo] - Information about forwarded messages (standardized format)
 * @param {string} [params.mediaGroupId] - Group ID for media groups
 * @param {Json} [params.captionData] - Analyzed caption data from caption parsing
 * @param {Json} [params.analyzedContent] - Same as captionData, stored in analyzed_content field
 * @param {Record<string, any>} [params.additionalUpdates] - Additional fields to update (e.g., for old_analyzed_content)
 * @param {string} params.correlationId - Request correlation ID for tracing
 * 
 * @behavior
 * When a duplicate media message arrives with a different caption:
 * 1. The function detects caption changes by comparing with existing records
 * 2. Current analyzed_content is preserved by moving it to old_analyzed_content array
 * 3. Processing state is reset to trigger reanalysis with the new caption
 * 4. For media groups, all related messages are synchronized with the new caption
 * 
 * @implementation
 * In the TypeScript implementation, analyzedContent is passed to the p_caption_data parameter
 * in the database function. The PostgreSQL function handles moving current content to history.
 * 
 * @returns {Promise<DbOperationResult<{ id: string }>>} Operation result with the created or updated message ID
 * 
 * @example
 * // Basic media message upsert
 * const result = await upsertMediaMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: 67890,
 *   fileUniqueId: "AQADkK4xG_cN6EZ-", // Critical for duplicate detection
 *   fileId: "AgADBAADv6kxG-1fAUgQ8P4AAQNLrOVKiwAEgQ",
 *   storagePath: "media/photos/AQADkK4xG_cN6EZ-.jpeg",
 *   publicUrl: "https://example.com/storage/media/photos/AQADkK4xG_cN6EZ-.jpeg",
 *   mimeType: "image/jpeg",
 *   extension: "jpeg",
 *   mediaType: "photo",
 *   caption: "Beautiful sunset! #vacation",
 *   messageData: { /* Telegram message object */ },
 *   processingState: "initialized",
 *   correlationId: "abc-123"
 * });
 * 
 * // Media message with analyzed content
 * const resultWithAnalysis = await upsertMediaMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: 67890,
 *   fileUniqueId: "AQADkK4xG_cN6EZ-",
 *   // [Other required fields...]
 *   caption: "Beautiful sunset! #vacation",
 *   captionData: {
 *     parsed_entities: [
 *       { type: "hashtag", text: "#vacation" }
 *     ]
 *   },
 *   analyzedContent: {
 *     parsed_entities: [
 *       { type: "hashtag", text: "#vacation" }
 *     ]
 *   },
 *   processingState: "processed",
 *   correlationId: "abc-123"
 * });
 * 
 * if (result.success) {
 *   console.log(`Message upserted with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to upsert message: ${result.error}`);
 * }
 */
```

## Database Result Types

```typescript
/**
 * Standard result type for database operations
 * 
 * This type provides consistent error handling and typing for all database
 * functions, ensuring proper propagation of success/failure states.
 * 
 * @template T - The type of data returned on success
 * 
 * @property {boolean} success - Whether the operation succeeded
 * @property {T} [data] - The data returned on success (if any)
 * @property {string} [error] - Error message if operation failed
 * @property {string} [errorCode] - Error code if available
 * 
 * @example
 * // Function returning a typed result
 * async function findUserById(id: string): Promise<DbOperationResult<User>> {
 *   try {
 *     const { data, error } = await supabaseClient
 *       .from('users')
 *       .select('*')
 *       .eq('id', id)
 *       .single();
 *       
 *     if (error) {
 *       return {
 *         success: false,
 *         error: error.message,
 *         errorCode: error.code
 *       };
 *     }
 *     
 *     return {
 *       success: true,
 *       data
 *     };
 *   } catch (e) {
 *     return {
 *       success: false,
 *       error: e.message
 *     };
 *   }
 * }
 */
```

## Message Record Type

```typescript
/**
 * Message record for database operations
 * 
 * This interface defines the structure of media message records in the database
 * and is used for type-safe operations when fetching, creating, or updating messages.
 * 
 * @property {number} telegram_message_id - Telegram message ID
 * @property {number} chat_id - Chat ID where the message was sent
 * @property {string} chat_type - Type of chat (private, group, supergroup, channel)
 * @property {string} [chat_title] - Title of the chat if available
 * @property {number} [user_id] - User ID who sent the message
 * @property {Json | null} [caption_data] - Processed caption data
 * @property {ProcessingState} processing_state - Current processing state
 * @property {string} correlation_id - Correlation ID for request tracking
 * @property {ForwardInfo | null} [forward_info] - Forward information if message is forwarded
 * @property {any[]} [edit_history] - Edit history for tracking changes
 * @property {string} [file_unique_id] - Unique file ID from Telegram
 * @property {string | null} [storage_path] - Path where the file is stored
 * @property {string | null} [public_url] - Public URL of the file
 * @property {string | null} [mime_type] - MIME type of the file
 * @property {string | null} [extension] - File extension
 * @property {string | null} [media_type] - Type of media (photo, video, etc.)
 * @property {string | null} [caption] - Caption of the message
 * @property {string | null} [media_group_id] - Media group ID if message is part of a media group
 * @property {string | null} [file_id] - File ID of the message
 * @property {Json | null} [analyzed_content] - Structured data from caption analysis
 * 
 * @example
 * // Typechecking a message record
 * function processMediaMessage(message: MessageRecord) {
 *   if (message.media_group_id) {
 *     console.log(`Message is part of media group ${message.media_group_id}`);
 *   }
 *   
 *   if (message.analyzed_content) {
 *     console.log(`Message has analyzed content: ${JSON.stringify(message.analyzed_content)}`);
 *   }
 * }
 */
```

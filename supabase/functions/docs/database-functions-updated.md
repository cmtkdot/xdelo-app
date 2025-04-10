# Core Database Functions for Telegram Webhook

This document provides comprehensive documentation for the TypeScript functions used in the `telegram-webhook` Supabase Edge Function to interact with the database. These functions handle media messages, captions, processing events, and audit logging.

## Table of Contents

1. [Data Structures](#data-structures)
2. [Message Operations](#message-operations)
   - [createMessageRecord](#createmessagerecord)
   - [updateMessageRecord](#updatemessagerecord)
   - [findMessageByTelegramId](#findmessagebytelegramid)
   - [findMessageByFileUniqueId](#findmessagebyfileuniqueid)
   - [updateMessageWithError](#updatemessagewitherror)
3. [Other Message Operations](#other-message-operations)
   - [createOtherMessageRecord](#createothermessagerecord)
4. [Audit Logging](#audit-logging)
   - [logProcessingEvent](#logprocessingevent)
5. [Media Group Operations](#media-group-operations)
   - [syncMediaGroupContent](#syncmediagroupcontent)

---

## Data Structures

### Common Types

```typescript
/**
 * Possible states for message processing
 */
export type ProcessingState = 
  | 'initialized'  // Initial state for new messages
  | 'pending'      // Ready for caption analysis
  | 'processing'   // Analysis in progress
  | 'completed'    // Successfully processed
  | 'error';       // Processing failed

/**
 * Information about a forwarded message
 */
export interface ForwardInfo {
  /** ID of the user who forwarded the message */
  fromUserId?: number;
  /** Name of the user who forwarded the message */
  fromUserName?: string;
  /** ID of the chat the message was forwarded from */
  fromChatId?: number;
  /** Type of the chat the message was forwarded from */
  fromChatType?: string;
  /** Title of the chat the message was forwarded from */
  fromChatTitle?: string;
  /** Date the message was forwarded */
  forwardDate?: string;
}

/**
 * Result of a database operation
 */
export interface DbOperationResult<T = undefined> {
  /** Whether the operation was successful */
  success: boolean;
  /** Data returned from the operation (if successful) */
  data?: T;
  /** Error message (if unsuccessful) */
  error?: string;
  /** Error code (if available) */
  errorCode?: string;
}
```

### Message Parameters

```typescript
/**
 * Parameters for creating a new message record
 */
export interface CreateMessageParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Telegram chat ID */
  chatId: number;
  /** Telegram user ID (optional) */
  userId?: number;
  /** Date the message was sent */
  messageDate: Date;
  /** Message caption (for media messages) */
  caption?: string | null;
  /** Type of media (photo, video, document) */
  mediaType?: string | null;
  /** Telegram file ID */
  fileId?: string | null;
  /** Unique identifier for the file from Telegram */
  fileUniqueId?: string | null;
  /** Path where the file is stored */
  storagePath?: string | null;
  /** Public URL of the file */
  publicUrl?: string | null;
  /** MIME type of the file */
  mimeType?: string | null;
  /** File extension */
  extension?: string | null;
  /** Raw Telegram message object */
  messageData: Json;
  /** Current processing state */
  processingState: ProcessingState;
  /** Error message if processing failed */
  processingError?: string | null;
  /** Information about forwarded messages */
  forwardInfo?: ForwardInfo | null;
  /** Media group ID for grouped messages */
  mediaGroupId?: string | null;
  /** Processed caption data */
  captionData?: Json | null;
  /** Correlation ID for request tracking */
  correlationId: string;
}

/**
 * Parameters for updating an existing message record
 */
export interface UpdateMessageParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Telegram chat ID */
  chatId: number;
  /** Date the message was edited (optional) */
  editDate?: Date | null;
  /** Updated message caption (optional) */
  caption?: string | null;
  /** Updated media type (optional) */
  mediaType?: string | null;
  /** Updated file ID (optional) */
  fileId?: string | null;
  /** Updated file unique ID (optional) */
  fileUniqueId?: string | null;
  /** Updated storage path (optional) */
  storagePath?: string | null;
  /** Updated public URL (optional) */
  publicUrl?: string | null;
  /** Updated MIME type (optional) */
  mimeType?: string | null;
  /** Updated file extension (optional) */
  extension?: string | null;
  /** Updated raw message data (optional) */
  messageData?: Json;
  /** Updated processing state (optional) */
  processingState?: ProcessingState;
  /** Updated processing error (optional) */
  processingError?: string | null;
  /** Updated caption data (optional) */
  captionData?: Json | null;
  /** Correlation ID for request tracking */
  correlationId: string;
}

/**
 * Parameters for creating a non-media message record
 */
export interface CreateOtherMessageParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Telegram chat ID */
  chatId: number;
  /** Telegram user ID (optional) */
  userId?: number;
  /** Date the message was sent */
  messageDate: Date;
  /** Type of message (text, sticker, service) */
  messageType?: string;
  /** Message text content */
  text?: string | null;
  /** Raw Telegram message object */
  rawMessageData: Json;
  /** Type of chat (private, group, supergroup, channel) */
  chatType?: string | null;
  /** Title of the chat */
  chatTitle?: string | null;
  /** Correlation ID for request tracking */
  correlationId: string;
}
```

---

## Message Operations

### createMessageRecord

Creates a new record in the `messages` table for media messages (photos, videos, documents).

```typescript
/**
 * Create a new message record in the database
 * 
 * This function creates a new record in the messages table for media messages
 * (photos, videos, documents). It handles the conversion of JavaScript objects
 * to database-compatible formats and performs error handling.
 * 
 * @param params - The input parameters containing message and media details
 * @returns A promise resolving to an operation result with the created message ID
 * 
 * @example
 * // Create a new message record for a photo
 * const result = await createMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: -1001234567890,
 *   userId: 98765432,
 *   messageDate: new Date(),
 *   caption: "Beautiful sunset",
 *   mediaType: "photo",
 *   fileId: "AgACAgQAAxkBAAIBZWUiHG...",
 *   fileUniqueId: "AgADcAUAAj-vwFc",
 *   storagePath: "AgADcAUAAj-vwFc.jpeg",
 *   publicUrl: "https://example.com/storage/AgADcAUAAj-vwFc.jpeg",
 *   mimeType: "image/jpeg",
 *   extension: "jpeg",
 *   messageData: telegramMessageObject,
 *   processingState: "initialized",
 *   correlationId: "req-abc-123"
 * });
 * 
 * if (result.success) {
 *   console.log(`Created message with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to create message: ${result.error}`);
 *   if (result.errorCode === '23505') {
 *     console.log("Message already exists (duplicate)");
 *   }
 * }
 */
export async function createMessageRecord(
  params: CreateMessageParams
): Promise<DbOperationResult<{ id: string }>>;
```

### updateMessageRecord

Updates an existing record in the `messages` table, typically after processing or when handling edited messages.

```typescript
/**
 * Update an existing message record in the database
 * 
 * This function updates an existing record in the messages table identified by
 * the combination of telegram_message_id and chat_id. Only the fields provided
 * in the params object will be updated.
 * 
 * @param params - The input parameters containing fields to update
 * @returns A promise resolving to an operation result
 * 
 * @example
 * // Update a message after processing its caption
 * const result = await updateMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: -1001234567890,
 *   processingState: "completed",
 *   captionData: {
 *     productName: "Gelato Cake",
 *     productCode: "GC123456",
 *     quantity: 2
 *   },
 *   correlationId: "req-abc-123"
 * });
 * 
 * if (result.success) {
 *   console.log("Message updated successfully");
 * } else {
 *   console.error(`Failed to update message: ${result.error}`);
 * }
 * 
 * // Update a message that was edited in Telegram
 * const editResult = await updateMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: -1001234567890,
 *   editDate: new Date(),
 *   caption: "Updated caption text",
 *   processingState: "pending", // Reset to pending to trigger reprocessing
 *   correlationId: "req-abc-123"
 * });
 */
export async function updateMessageRecord(
  params: UpdateMessageParams
): Promise<DbOperationResult>;
```

### findMessageByTelegramId

Finds a message record by its Telegram message ID and chat ID.

```typescript
/**
 * Find a message record by its Telegram message ID and chat ID
 * 
 * This function queries the messages table for a record matching the unique
 * combination of telegram_message_id and chat_id.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param telegramMessageId - The Telegram message ID
 * @param chatId - The Telegram chat ID
 * @param correlationId - The correlation ID for request tracking
 * @returns A promise resolving to an operation result with the message record if found
 * 
 * @example
 * // Find a message by its Telegram ID and chat ID
 * const result = await findMessageByTelegramId(
 *   supabaseClient,
 *   12345,
 *   -1001234567890,
 *   "req-abc-123"
 * );
 * 
 * if (result.success && result.data) {
 *   console.log(`Found message with ID: ${result.data.id}`);
 *   console.log(`Processing state: ${result.data.processing_state}`);
 * } else {
 *   console.log("Message not found");
 * }
 */
export async function findMessageByTelegramId(
  supabaseClient: SupabaseClient<Database>,
  telegramMessageId: number,
  chatId: number,
  correlationId: string
): Promise<DbOperationResult<MessageRecord | null>>;
```

### findMessageByFileUniqueId

Finds a message record by its file unique ID from Telegram.

```typescript
/**
 * Find a message record by its file unique ID
 * 
 * This function queries the messages table for a record matching the given
 * file_unique_id. This is useful for detecting duplicate media files.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param fileUniqueId - The unique file ID from Telegram
 * @param correlationId - The correlation ID for request tracking
 * @returns A promise resolving to an operation result with the message record if found
 * 
 * @example
 * // Check if a file already exists in the database
 * const result = await findMessageByFileUniqueId(
 *   supabaseClient,
 *   "AgADcAUAAj-vwFc",
 *   "req-abc-123"
 * );
 * 
 * if (result.success && result.data) {
 *   console.log(`File already exists in message: ${result.data.id}`);
 *   console.log(`Public URL: ${result.data.public_url}`);
 * } else {
 *   console.log("File not found, proceed with download and storage");
 * }
 */
export async function findMessageByFileUniqueId(
  supabaseClient: SupabaseClient<Database>,
  fileUniqueId: string,
  correlationId: string
): Promise<DbOperationResult<MessageRecord | null>>;
```

### updateMessageWithError

Updates a message record to record processing errors.

```typescript
/**
 * Update a message record with error information
 * 
 * This function updates the error_message, error_type, last_error_at, and
 * increments the retry_count fields for a specific message record identified
 * by its database UUID.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param messageId - The database UUID of the message record
 * @param errorMessage - The description of the error
 * @param errorType - A category for the error (e.g., 'MediaProcessingError')
 * @param correlationId - The correlation ID for request tracking
 * @returns A promise resolving to an operation result
 * 
 * @example
 * // Record an error during media processing
 * const result = await updateMessageWithError(
 *   supabaseClient,
 *   "550e8400-e29b-41d4-a716-446655440000", // Database UUID
 *   "Failed to download media: timeout after 30s",
 *   "MediaDownloadError",
 *   "req-abc-123"
 * );
 * 
 * if (result.success) {
 *   console.log("Error recorded successfully");
 * } else {
 *   console.error(`Failed to record error: ${result.error}`);
 * }
 */
export async function updateMessageWithError(
  supabaseClient: SupabaseClient<Database>,
  messageId: string,
  errorMessage: string,
  errorType: string,
  correlationId: string
): Promise<DbOperationResult>;
```

---

## Other Message Operations

### createOtherMessageRecord

Creates a new record in the `other_messages` table for non-media messages.

```typescript
/**
 * Create a new record for non-media messages
 * 
 * This function creates a new record in the other_messages table for
 * non-media messages like text messages, stickers, or service messages.
 * 
 * @param params - The input parameters containing message details
 * @returns A promise resolving to an operation result with the created message ID
 * 
 * @example
 * // Create a record for a text message
 * const result = await createOtherMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: -1001234567890,
 *   userId: 98765432,
 *   messageDate: new Date(),
 *   messageType: "text",
 *   text: "Hello, world!",
 *   rawMessageData: telegramMessageObject,
 *   chatType: "supergroup",
 *   chatTitle: "My Awesome Group",
 *   correlationId: "req-abc-123"
 * });
 * 
 * if (result.success) {
 *   console.log(`Created other message with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to create other message: ${result.error}`);
 * }
 */
export async function createOtherMessageRecord(
  params: CreateOtherMessageParams
): Promise<DbOperationResult<{ id: string }>>;
```

---

## Audit Logging

### logProcessingEvent

Logs an event related to message processing into the `unified_audit_logs` table.

```typescript
/**
 * Log a processing event to the audit log
 * 
 * This function creates an audit log entry to track the lifecycle and potential
 * issues during message processing. It's crucial for debugging and monitoring.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param eventType - A string identifying the event (e.g., 'media_download_start')
 * @param entityId - The ID of the related entity (usually the database message UUID)
 * @param correlationId - The correlation ID for request tracking
 * @param metadata - An optional JSON object for additional context
 * @param errorMessage - An optional error message if the event represents a failure
 * @returns A promise resolving to an operation result with the created audit log ID
 * 
 * @example
 * // Log a successful media processing event
 * const successResult = await logProcessingEvent(
 *   supabaseClient,
 *   'media_processed',
 *   '550e8400-e29b-41d4-a716-446655440000', // Database message UUID
 *   'req-abc-123',
 *   { 
 *     file_size: 12345, 
 *     mime_type: 'image/jpeg',
 *     processing_time_ms: 235
 *   }
 * );
 * 
 * // Log an error event
 * const errorResult = await logProcessingEvent(
 *   supabaseClient,
 *   'caption_parse_failed',
 *   '550e8400-e29b-41d4-a716-446655440000', // Database message UUID
 *   'req-abc-123',
 *   { 
 *     caption: "Product #123 x 2",
 *     parser: "manual"
 *   },
 *   "Failed to extract product code from caption"
 * );
 */
export async function logProcessingEvent(
  supabaseClient: SupabaseClient<Database>,
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata?: Record<string, any>,
  errorMessage?: string
): Promise<DbOperationResult<{ id: string }>>;
```

---

## Media Group Operations

### syncMediaGroupContent

Synchronizes analyzed content across all messages in a media group.

```typescript
/**
 * Synchronize analyzed content across all messages in a media group
 * 
 * This function ensures that all messages in a media group have consistent
 * analyzed content. It's typically called after processing a caption in one
 * of the group's messages.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param mediaGroupId - The Telegram media group ID
 * @param analyzedContent - The analyzed content to synchronize
 * @param sourceMessageId - The database UUID of the source message
 * @param correlationId - The correlation ID for request tracking
 * @returns A promise resolving to an operation result with the number of updated messages
 * 
 * @example
 * // Synchronize analyzed content across a media group
 * const result = await syncMediaGroupContent(
 *   supabaseClient,
 *   "12345678901234567", // Telegram media group ID
 *   {
 *     productName: "Gelato Cake",
 *     productCode: "GC123456",
 *     quantity: 2
 *   },
 *   "550e8400-e29b-41d4-a716-446655440000", // Source message UUID
 *   "req-abc-123"
 * );
 * 
 * if (result.success) {
 *   console.log(`Synchronized content across ${result.data.count} messages`);
 * } else {
 *   console.error(`Failed to synchronize media group: ${result.error}`);
 * }
 */
export async function syncMediaGroupContent(
  supabaseClient: SupabaseClient<Database>,
  mediaGroupId: string,
  analyzedContent: Json,
  sourceMessageId: string,
  correlationId: string
): Promise<DbOperationResult<{ count: number }>>;
```

---

## Database-Level Objects

### Triggers

These execute automatically `BEFORE` or `AFTER` `INSERT`, `UPDATE`, or `DELETE` operations on tables.

- **messages_audit_trigger**: Logs changes to the `messages` table in the `unified_audit_logs` table
- **media_group_sync_trigger**: Triggers synchronization of analyzed content across media group members

### RLS Policies

These control which rows users or roles can access or modify.

- **messages_read_policy**: Controls who can read message records
- **messages_insert_policy**: Controls who can insert new message records
- **messages_update_policy**: Controls who can update existing message records

### SQL Functions

Custom functions written in SQL or PL/pgSQL that can be called from application code, triggers, or RLS policies.

- **sync_media_group_content**: Database-level function to synchronize content across media groups
- **process_message_caption**: Analyzes message captions and extracts structured data
- **handle_message_edit**: Manages the edit history when a message is updated

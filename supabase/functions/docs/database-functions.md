# Core Database Functions for Telegram Webhook

This document outlines the essential TypeScript functions used by the `telegram-webhook` Supabase Edge Function to interact with the database, primarily focusing on handling media messages, captions, and processing events.

These functions are typically located in `supabase/functions/telegram-webhook/utils/dbOperations.ts`.

**Note:** This documentation focuses on the application-level functions. Any custom SQL Triggers or Functions defined directly within your Supabase database (e.g., via the Supabase Dashboard) are not automatically included here and should be documented separately if they are critical to the webhook's logic.

---

## Application-Level Functions (`dbOperations.ts`)

These functions provide a typed interface for common database operations related to message processing.

### 1. `createMessageRecord`

Creates a new record in the `messages` table, typically used for incoming media messages.

**Signature:**
```typescript
import { SupabaseClient, Json } from '@supabase/supabase-js';
import { Database } from '../../_shared/types'; // Adjusted path
import { ProcessingState, ForwardInfo, DbOperationResult } from './dbOperations';

interface CreateMessageParams {
  supabaseClient: SupabaseClient<Database>;
  messageId: number;
  chatId: number;
  userId?: number;
  messageDate: Date;
  caption?: string | null;
  mediaType?: string | null;
  fileId?: string | null;
  fileUniqueId?: string | null;
  storagePath?: string | null;
  publicUrl?: string | null;
  mimeType?: string | null;
  extension?: string | null;
  messageData: Json; // Raw Telegram message object
  processingState: ProcessingState;
  processingError?: string | null;
  forwardInfo?: ForwardInfo | null;
  mediaGroupId?: string | null;
  captionData?: Json | null; // Processed caption data
  correlationId: string;
}

async function createMessageRecord(
  params: CreateMessageParams
): Promise<DbOperationResult<{ id: string }>>;
```

**Description:**
Takes message details, media metadata (if processed), and the raw Telegram message object, then inserts a corresponding row into the `public.messages` table.

**Parameters:**
- `params`: An object conforming to the `CreateMessageParams` interface, containing all necessary data for the new message record.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` object.
- On success: `{ success: true, data: { id: 'new-message-uuid' } }`
- On failure: `{ success: false, error: 'Error message', errorCode?: 'DB_ERROR_CODE' }`

**Usage Example:**
```typescript
const result = await createMessageRecord({
  supabaseClient,
  messageId: 12345,
  chatId: -100123,
  userId: 9876,
  messageDate: new Date(),
  mediaType: 'photo',
  fileUniqueId: 'unique-file-id',
  storagePath: 'user/photo.jpg',
  publicUrl: 'https://...', 
  messageData: telegramMessageObject, // Raw JSON
  processingState: 'processed',
  correlationId: 'req-uuid',
});
if (result.success) {
  console.log(`Created message with ID: ${result.data.id}`);
}
```

---

### 2. `updateMessageRecord`

Updates an existing record in the `messages` table, often used after media processing, caption parsing, or handling edited messages.

**Signature:**
```typescript
interface UpdateMessageParams {
  supabaseClient: SupabaseClient<Database>;
  messageId: number; // Telegram Message ID
  chatId: number;
  // Optional fields to update:
  editDate?: Date | null;
  caption?: string | null;
  mediaType?: string | null;
  fileId?: string | null;
  fileUniqueId?: string | null;
  storagePath?: string | null;
  publicUrl?: string | null;
  mimeType?: string | null;
  extension?: string | null;
  messageData?: Json; // Updated raw message data
  processingState?: ProcessingState;
  processingError?: string | null;
  captionData?: Json | null;
  correlationId: string;
}

async function updateMessageRecord(
  params: UpdateMessageParams
): Promise<DbOperationResult>;
```

**Description:**
Updates an existing message record identified by `messageId` (Telegram ID) and `chatId`. Only the fields provided in the `params` object are updated.

**Parameters:**
- `params`: An object conforming to the `UpdateMessageParams` interface.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` object.
- On success: `{ success: true }`
- On failure: `{ success: false, error: 'Error message', errorCode?: 'DB_ERROR_CODE' }`

**Usage Example:**
```typescript
const result = await updateMessageRecord({
  supabaseClient,
  messageId: 12345,
  chatId: -100123,
  editDate: new Date(),
  caption: 'Updated caption',
  processingState: 'processed',
  correlationId: 'req-uuid',
});
if (result.success) {
  console.log('Message updated successfully');
}
```

---

### 3. `findMessageByTelegramId`

Finds a message record using the Telegram Message ID and Chat ID combination.

**Signature:**
```typescript
import { MessageRecord } from './types'; // Assuming MessageRecord type is defined

async function findMessageByTelegramId(
  supabaseClient: SupabaseClient<Database>,
  telegramMessageId: number,
  chatId: number,
  correlationId: string
): Promise<DbOperationResult<MessageRecord | null>>;
```

**Description:**
Queries the `messages` table for a record matching the unique combination of `telegram_message_id` and `chat_id`.

**Parameters:**
- `supabaseClient`: The Supabase client instance.
- `telegramMessageId`: The Telegram ID of the message.
- `chatId`: The Telegram ID of the chat.
- `correlationId`: The request correlation ID.

**Returns:**
- A `Promise` resolving to a `DbOperationResult`.
- On success (found): `{ success: true, data: { ...MessageRecord } }`
- On success (not found): `{ success: true, data: null }`
- On failure: `{ success: false, error: 'Error message', errorCode?: 'DB_ERROR_CODE' }`

---

### 4. `findMessageByFileUniqueId`

Finds a message record using the Telegram `file_unique_id`.

**Signature:**
```typescript
async function findMessageByFileUniqueId(
  supabaseClient: SupabaseClient<Database>,
  fileUniqueId: string,
  correlationId: string
): Promise<DbOperationResult<MessageRecord | null>>;
```

**Description:**
Queries the `messages` table for a record matching the given `file_unique_id`. Useful for detecting potential duplicate media uploads across different messages or chats (if applicable).

**Parameters:**
- `supabaseClient`: The Supabase client instance.
- `fileUniqueId`: The Telegram `file_unique_id`.
- `correlationId`: The request correlation ID.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` similar to `findMessageByTelegramId`.

---

### 5. `updateMessageWithError`

Updates a message record specifically to record processing errors.

**Signature:**
```typescript
async function updateMessageWithError(
  supabaseClient: SupabaseClient<Database>,
  messageId: string, // Database UUID of the message record
  errorMessage: string,
  errorType: string,
  correlationId: string
): Promise<DbOperationResult>;
```

**Description:**
Updates the `error_message`, `error_type`, `last_error_at`, and increments the `retry_count` fields for a specific message record identified by its *database* `id` (UUID).

**Parameters:**
- `supabaseClient`: The Supabase client instance.
- `messageId`: The database UUID of the message record to update.
- `errorMessage`: The description of the error.
- `errorType`: A category for the error (e.g., 'MediaProcessingError', 'DbError').
- `correlationId`: The request correlation ID.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` indicating success or failure of the update.

---

### 6. `createOtherMessageRecord`

Creates a new record in the `other_messages` table for non-media messages (like text, stickers, etc.).

**Signature:**
```typescript
interface CreateOtherMessageParams {
  supabaseClient: SupabaseClient<Database>;
  messageId: number; // Telegram Message ID
  chatId: number;
  userId?: number;
  messageDate: Date;
  messageType?: string; // e.g., 'text', 'sticker', 'service'
  text?: string | null;
  rawMessageData: Json; // Raw Telegram message object
  chatType?: string | null;
  chatTitle?: string | null;
  correlationId: string;
}

async function createOtherMessageRecord(
  params: CreateOtherMessageParams
): Promise<DbOperationResult<{ id: string }>>;
```

**Description:**
Handles messages that don't contain primary media by inserting a record into the separate `other_messages` table.

**Parameters:**
- `params`: An object conforming to the `CreateOtherMessageParams` interface.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` similar to `createMessageRecord`.

---

### 7. `logProcessingEvent`

Logs an event related to message processing into the `unified_audit_logs` table.

**Signature:**
```typescript
async function logProcessingEvent(
  supabaseClient: SupabaseClient<Database>,
  eventType: string,
  entityId: string | null, // Often the DB message ID (UUID)
  correlationId: string,
  metadata?: Record<string, any>,
  errorMessage?: string
): Promise<DbOperationResult<{ id: string }>>;
```

**Description:**
Creates an audit log entry to track the lifecycle and potential issues during message processing. This is crucial for debugging and monitoring.

**Parameters:**
- `supabaseClient`: The Supabase client instance.
- `eventType`: A string identifying the event (e.g., 'media_download_start', 'caption_parse_failed').
- `entityId`: The ID of the related entity (usually the database message UUID), can be null if the event is not tied to a specific record yet.
- `correlationId`: The request correlation ID.
- `metadata`: An optional JSON object for additional context.
- `errorMessage`: An optional error message if the event represents a failure.

**Returns:**
- A `Promise` resolving to a `DbOperationResult` containing the ID of the created audit log entry on success.

---

## Database-Level Objects (Triggers, RLS, Functions)

As mentioned, application-level code relies on the database behaving as expected. Complex logic can also reside directly within the database as SQL Functions, Triggers, or Row Level Security (RLS) policies.

- **Triggers:** These execute automatically `BEFORE` or `AFTER` `INSERT`, `UPDATE`, or `DELETE` operations on tables (like `messages` or `other_messages`). They might be used for data validation, logging, or updating related tables.
- **RLS Policies:** These control which rows users or roles can access or modify. Complex policies can involve function calls or subqueries.
- **SQL Functions:** Custom functions written in SQL or PL/pgSQL that can be called from application code, triggers, or RLS policies.

**Important:** Review your Supabase project's dashboard, specifically the `Database -> Triggers` and `Authentication -> Policies` sections for the `messages` and `other_messages` tables, to identify and document any custom database-level logic that complements these application functions. The error `missing FROM-clause entry for table "supabase"` strongly suggests such custom logic might exist and potentially contain an error.

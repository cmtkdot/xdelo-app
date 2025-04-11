# Core TypeScript Functions

This document describes the key TypeScript functions used in the Telegram webhook processing flow, particularly those that interact with the database via PostgreSQL functions.

## Table of Contents

1. [upsertMediaMessageRecord](#upsertmediamessagerecord)
2. [upsertTextMessageRecord](#upserttextmessagerecord)
3. [extractForwardInfo](#extractforwardinfo)
4. [syncMediaGroupCaptions](#syncmediagroupcaptions)
5. [findMessageByFileUniqueId](#findemessagebyfileuniqueid)

## upsertMediaMessageRecord

```typescript
async function upsertMediaMessageRecord({
  supabaseClient,
  messageId,
  chatId,
  caption,
  mediaType,
  fileId,
  fileUniqueId,
  storagePath,
  publicUrl,
  mimeType,
  extension,
  messageData,
  processingState,
  processingError,
  forwardInfo,
  mediaGroupId,
  captionData,
  analyzedContent,
  oldAnalyzedContent,
  correlationId,
  additionalUpdates = {}
}: {
  supabaseClient: SupabaseClient;
  messageId: number;
  chatId: number;
  caption: string | null;
  mediaType: string;
  fileId: string;
  fileUniqueId: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  extension: string;
  messageData: any;
  processingState: string;
  processingError: string | null;
  forwardInfo?: any;
  mediaGroupId?: string | null;
  captionData?: any;
  analyzedContent?: any;
  oldAnalyzedContent?: any[];
  correlationId: string;
  additionalUpdates?: Record<string, any>;
}): Promise<{ success: boolean; data?: any; error?: any }>
```

### Description

This function handles upserting media messages by calling the PostgreSQL `upsert_media_message` function. It ensures proper handling of media attributes, analyzed content, and history preservation for edited messages.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| supabaseClient | SupabaseClient | Client for database connection |
| messageId | number | Telegram message ID |
| chatId | number | Telegram chat ID |
| caption | string \| null | Caption text for the media |
| mediaType | string | Type of media (photo, video, document, etc.) |
| fileId | string | File ID from Telegram |
| fileUniqueId | string | **Critical**: Unique ID for the file from Telegram |
| storagePath | string | Local storage path for the file |
| publicUrl | string | Public URL for accessing the file |
| mimeType | string | MIME type of the file |
| extension | string | File extension |
| messageData | any | Complete Telegram message object |
| processingState | string | Current processing state |
| processingError | string \| null | Error message if processing failed |
| forwardInfo | any | Information about forwarded messages |
| mediaGroupId | string \| null | Group ID for grouped media |
| captionData | any | Structured data extracted from caption |
| analyzedContent | any | Analyzed content from caption |
| oldAnalyzedContent | any[] | History of previous analyzed content |
| correlationId | string | Tracking ID through the system |
| additionalUpdates | Record<string, any> | Additional fields to update |

### Returns

Promise resolving to an object with:
- `success`: boolean indicating if the operation was successful
- `data`: The upserted record data (if successful)
- `error`: Error information (if unsuccessful)

### Key Behaviors

1. **Parameter Mapping**:
   - Maps TypeScript parameters to PostgreSQL function parameters
   - Ensures names match the database function signature

2. **History Tracking**:
   - Properly handles `oldAnalyzedContent` for tracking caption edit history

3. **Logging**:
   - Logs operation details with correlation ID for traceability

4. **Comprehensive Error Handling**:
   - Catches and properly formats all errors
   - Includes detailed error information for debugging

### Example

```typescript
const result = await upsertMediaMessageRecord({
  supabaseClient,
  messageId: 123456789,
  chatId: -100123456789,
  caption: "Sample caption #tag",
  mediaType: "photo",
  fileId: "BAaz-qwerty123456",
  fileUniqueId: "ABCdef123",
  storagePath: "media/ABCdef123.jpg",
  publicUrl: "https://example.com/media/ABCdef123.jpg",
  mimeType: "image/jpeg",
  extension: "jpg",
  messageData: { message_id: 123456789, chat: { id: -100123456789, type: "supergroup" } },
  processingState: "initialized",
  processingError: null,
  forwardInfo: null,
  mediaGroupId: "media_group_123456789",
  captionData: { text: "Sample caption #tag", tags: ["tag"] },
  analyzedContent: { text: "Sample caption #tag", tags: ["tag"], processed: true },
  correlationId: "corr-123456789"
});
```

## upsertTextMessageRecord

```typescript
async function upsertTextMessageRecord({
  supabaseClient,
  messageId,
  chatId,
  messageText,
  messageData,
  chatType,
  chatTitle,
  forwardInfo,
  processingState,
  processingError,
  correlationId
}: {
  supabaseClient: SupabaseClient;
  messageId: number;
  chatId: number;
  messageText: string | null;
  messageData: any;
  chatType: string | null;
  chatTitle: string | null;
  forwardInfo?: any;
  processingState: string;
  processingError: string | null;
  correlationId: string;
}): Promise<{ success: boolean; data?: any; error?: any }>
```

### Description

Handles upserting text messages by calling the PostgreSQL `upsert_text_message` function, providing consistent handling with the media message workflow.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| supabaseClient | SupabaseClient | Client for database connection |
| messageId | number | Telegram message ID |
| chatId | number | Telegram chat ID |
| messageText | string \| null | Text content of the message |
| messageData | any | Complete Telegram message object |
| chatType | string \| null | Type of chat (private, group, etc.) |
| chatTitle | string \| null | Title of the chat |
| forwardInfo | any | Information about forwarded messages |
| processingState | string | Current processing state |
| processingError | string \| null | Error message if processing failed |
| correlationId | string | Tracking ID through the system |

### Returns

Promise resolving to an object with:
- `success`: boolean indicating if the operation was successful
- `data`: The upserted record data (if successful)
- `error`: Error information (if unsuccessful)

### Key Behaviors

1. **Parameter Mapping**:
   - Maps TypeScript parameters to PostgreSQL function parameters with correct position matching
   - Ensures names match the database function signature

2. **Complete Record Fetching**:
   - Fetches the complete record after upsert for comprehensive response

3. **Standardized Handling**:
   - Consistent approach with media message processing

### Example

```typescript
const result = await upsertTextMessageRecord({
  supabaseClient,
  messageId: 123456789,
  chatId: -100123456789,
  messageText: "This is a text message #tag",
  messageData: { message_id: 123456789, chat: { id: -100123456789, type: "supergroup" } },
  chatType: "supergroup",
  chatTitle: "My Super Group",
  forwardInfo: null,
  processingState: "initialized",
  processingError: null,
  correlationId: "corr-123456789"
});
```

## extractForwardInfo

```typescript
function extractForwardInfo(message: any): any
```

### Description

Extracts standardized forward information from a Telegram message object. This function normalizes forwarded message metadata across different types of forwards (from users, channels, etc.).

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| message | any | Telegram message object |

### Returns

A standardized forward info object with consistent field naming, or null if the message is not forwarded.

### Key Behaviors

1. **User Forward Detection**:
   - Detects messages forwarded from users via `message.forward_from`

2. **Channel Forward Detection**:
   - Detects messages forwarded from channels via `message.forward_from_chat`

3. **Standard Field Format**:
   - Uses consistent camelCase field naming
   - Formats date as ISO string for consistency

### Example

```typescript
const message = {
  message_id: 123456789,
  forward_from_chat: {
    id: -100987654321,
    type: "channel",
    title: "Sample Channel",
    username: "sample_channel"
  },
  forward_date: 1618047123
};

const forwardInfo = extractForwardInfo(message);
// Returns:
// {
//   forwarded_from_type: "channel",
//   forwarded_from_id: -100987654321,
//   forwarded_from_title: "Sample Channel",
//   forwarded_from_username: "sample_channel",
//   forwarded_date: "2021-04-10T12:18:43.000Z"
// }
```

## syncMediaGroupCaptions

```typescript
interface SyncMediaGroupCaptionsParams {
  supabaseClient: SupabaseClient;
  mediaGroupId: string;
  sourceMessageId?: string;
  newCaption?: string | null;
  captionData?: any;
  processingState?: string;
  correlationId: string;
}

async function syncMediaGroupCaptions({
  supabaseClient,
  mediaGroupId,
  sourceMessageId,
  newCaption,
  captionData,
  processingState = 'pending_analysis',
  correlationId
}: SyncMediaGroupCaptionsParams): Promise<{ success: boolean; data?: any; error?: any }>
```

### Description

Synchronizes captions across all messages in a media group. When a caption is updated on one message in a group, this function ensures all other messages in the same group have consistent captions. The function now uses a parameter object pattern for more flexibility and better null handling.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| supabaseClient | SupabaseClient | Client for database connection |
| mediaGroupId | string | Media group ID to synchronize (required non-null parameter) |
| sourceMessageId | string \| undefined | ID of the source message to exclude from updates (optional) |
| newCaption | string \| null \| undefined | New caption text to apply (optional) |
| captionData | any | Structured caption data to apply (optional) |
| processingState | string | Processing state to set (defaults to 'pending_analysis') |
| correlationId | string | Tracking ID through the system |

### Returns

Promise resolving to an object with:
- `success`: boolean indicating if the operation was successful
- `data`: The array of updated message IDs (if successful)
- `error`: Error information (if unsuccessful)

### Key Behaviors

1. **Null Parameter Validation**:
   - Only validates that mediaGroupId is non-null (critical parameter)
   - Other parameters can be null/undefined and are passed directly to PostgreSQL

2. **Parameter Object Pattern**:
   - Uses the same pattern as other database functions (named parameters)
   - Provides consistent interface across the codebase

3. **Return Value Consistency**:
   - Returns standardized result object format like other database functions
   - Includes success flag and data/error properties

4. **Error Handling**:
   - Uses try/catch pattern to handle errors gracefully
   - Logs detailed error information with correlation ID

### Example

```typescript
const result = await syncMediaGroupCaptions({
  supabaseClient,
  mediaGroupId: "media_group_123456789",
  sourceMessageId: "a1b2c3d4-e5f6-...",
  newCaption: "Updated caption for all media",
  captionData: { text: "Updated caption for all media" },
  processingState: "pending_analysis", // optional, has default
  correlationId: "corr-123456789"
});
```

## findMessageByFileUniqueId

```typescript
async function findMessageByFileUniqueId(
  supabaseClient: SupabaseClient,
  fileUniqueId: string,
  correlationId: string
): Promise<{ success: boolean; data?: any }>
```

### Description

Finds a message in the database by its file_unique_id. This is critical for duplicate detection and handling when processing media messages.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| supabaseClient | SupabaseClient | Client for database connection |
| fileUniqueId | string | Unique ID of the file from Telegram |
| correlationId | string | Tracking ID through the system |

### Returns

Promise resolving to an object with:
- `success`: boolean indicating if the search was successful
- `data`: Message data if found (undefined if not found or error)

### Key Behaviors

1. **Precise Matching**:
   - Searches using exact match on file_unique_id for reliable duplicate detection

2. **Detailed Logging**:
   - Logs search results for traceability
   - Includes correlation ID for cross-service tracking

3. **Comprehensive Error Handling**:
   - Handles database errors gracefully
   - Returns structured error information

### Example

```typescript
const result = await findMessageByFileUniqueId(
  supabaseClient,
  "ABCdef123",
  "corr-123456789"
);

if (result.success && result.data) {
  // Message found, handle as duplicate
} else {
  // New message
}
```

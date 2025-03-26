
# Telegram Webhook Flow Documentation

This document provides a comprehensive overview of the Telegram webhook implementation, including how it handles different types of messages, stores media, manages message edits, tracks forwarded messages, and handles duplicate detection.

## System Architecture

The Telegram webhook is implemented as a Supabase Edge Function that receives updates from the Telegram Bot API whenever a new message is sent to the bot. The system follows this high-level architecture:

```mermaid
graph TD
    A[Telegram Bot API] -->|Webhook Event| B[Supabase Edge Function]
    B -->|Parse & Route| C{Message Type}
    C -->|Media| D[Media Handler]
    C -->|Text| E[Text Handler]
    C -->|Edited| F[Edit Handler]
    D --> G[Media Storage]
    D --> H[Database: messages]
    E --> I[Database: other_messages]
    F --> J{Contains Media?}
    J -->|Yes| D
    J -->|No| E
    H --> K[Caption Analysis]
    H --> L[Media Group Sync]
    H --> M[Audit Logging]
```

## Webhook Entry Point

The primary entry point is `index.ts`, which receives all webhook events from Telegram, identifies the message type, and routes it to the appropriate handler:

1. **Initialization**: Creates a correlation ID for request tracing
2. **Message Extraction**: Extracts message data from various update types
3. **Context Building**: Determines message context (forwarded, edited, channel post)
4. **Routing**: Routes to appropriate handler based on message type
   - Media messages → `handleMediaMessage`
   - Edited messages → `handleEditedMessage`
   - Other messages → `handleOtherMessage`

## Message Types & Handling

### Media Messages

Media messages (photos, videos, documents) are processed by `mediaMessageHandler.ts`:

1. **MIME Type Detection**: Accurately determines file type based on Telegram message structure
2. **Duplicate Detection**: Checks if the file has been seen before (based on `file_unique_id`)
3. **Media Download**: Downloads media from Telegram to Supabase Storage with proper content-type
4. **Storage Path Generation**: Creates standardized paths based on file ID and correct extension
5. **Database Storage**: Stores metadata in the `messages` table
6. **Caption Processing**: Extracts product information from captions

Media Group handling:
- Messages with the same `media_group_id` are treated as a group
- Caption from one message can be synchronized across the group
- Media groups are identified and linked together

### Edited Messages

Edited messages are processed by `editedMessageHandler.ts`:

1. **Original Message Lookup**: Finds the original message in the database
2. **Edit Tracking**: Records edit history including:
   - Previous caption/content
   - Edit timestamp
   - Changes in media (if applicable)
3. **Media Changes**: If media was replaced:
   - Downloads new media from Telegram with accurate MIME type detection
   - Updates storage and database records
   - Preserves edit history
4. **Caption**: always reprocess and update caption
   - Reset the caption and parsing and media group syncing logic 
   - Updates caption in database set procesing state back to processing if it has a caption
   - Reprocesses caption for product information
   - Synchronizes changes across media groups

### Text Messages

Non-media messages are processed by `textMessageHandler.ts`:

1. **Database Storage**: Stored in the `other_messages` table
2. **Edit Handling**: For edited text messages:
   - Maintains edit history
   - Updates message content
   - Records edit metadata
3. Falls back to just storing the telegram webhook data as a jsonb as a error handling

## Forwarded Messages

Forwarded messages have special handling:

1. **Origin Detection**: Identifies message source:
   - Original chat ID
   - Original message ID
   - Forward source (user, channel)
2. **Metadata Storage**: Records forward information in the `forward_info` field
3. **Relationship Tracking**: Maintains relationships between original and forwarded content
4. Update the caption and analyzed_content product info with the new info from the forwarded content if it has a duplicate then sync changes with media group

## Media Storage & Management

Media files are managed by `mediaUtils.ts`:

1. **Enhanced MIME Type Detection**:
   - Analyzes Telegram message structure for accurate file type identification
   - Handles all media types: photos, videos, documents, stickers, etc.
   - Uses fallback detection based on file extensions when needed
2. **Download Process**:
   - Retrieves file information from Telegram
   - Downloads the actual file content with proper MIME type detection
   - Uses retry logic with exponential backoff
   - Handles timeouts and network errors
3. **Storage Organization**:
   - Files are stored using their `file_unique_id` as a unique identifier
   - File extensions are derived from accurate MIME types
   - Standardized storage paths ensure consistency
4. **Content Disposition**:
   - Viewable media (images, videos) set as "inline"
   - Documents set as "attachment" for downloading

## Media Repair Capabilities

The system includes robust media repair functionality:

1. **Storage Verification**: Checks if files exist in storage
2. **MIME Type Correction**: Fixes incorrect content types
3. **Path Standardization**: Ensures consistent path formatting
4. **Redownload**: Can re-fetch files from Telegram when needed
5. **Batch Processing**: Can repair individual files or entire media groups
6. **Content-Type Fixing**: Updates content-disposition for proper display

## Database Schema

### Messages Table

Stores media messages with fields:

```
- id: UUID (primary key)
- telegram_message_id: int (Telegram's message identifier)
- chat_id: int (Telegram chat identifier)
- chat_type: string (group, private, channel)
- chat_title: string (optional, for groups/channels)
- media_group_id: string (optional, for grouped media)
- caption: string (optional message caption)
- file_id: string (Telegram file identifier)
- file_unique_id: string (Telegram's permanent unique file ID)
- mime_type: string (e.g., image/jpeg, video/mp4)
- mime_type_original: string (original mime type from Telegram)
- mime_type_verified: boolean (whether mime type is verified)
- file_size: int (bytes)
- width/height: int (for photos/videos)
- duration: int (for videos, in seconds)
- storage_path: string (location in Supabase Storage)
- public_url: string (direct URL to media)
- content_disposition: string ('inline' or 'attachment')
- processing_state: enum ('pending', 'processing', 'completed', 'error')
- analyzed_content: JSON (extracted product data)
- old_analyzed_content: JSON array (history of product data from edits)
- telegram_data: JSON (full Telegram message data)
- forward_info: JSON (metadata about forwarded messages)
- edit_history: JSON array (record of edits)
- edit_count: int (number of edits)
- needs_redownload: boolean (flag for failed downloads)
- redownload_reason: string (why redownload is needed)
- storage_exists: boolean (verification flag)
- storage_path_standardized: boolean (if path follows standards)
```

### Other Messages Table

Stores non-media messages with fields:

```
- id: UUID (primary key)
- telegram_message_id: int
- chat_id: int
- chat_type: string
- chat_title: string (optional)
- message_type: string
- message_text: string
- telegram_data: JSON
- processing_state: enum ('pending', 'processing', 'completed', 'error')
- is_forward: boolean
- edit_history: JSON array
- edit_count: int
- correlation_id: string (for request tracing)
```

### Unified Audit Logs

Records all operations for tracking and debugging:

```
- id: UUID (primary key)
- event_type: string (e.g., 'message_created', 'processing_state_changed')
- entity_id: UUID (reference to message)
- telegram_message_id: int
- chat_id: int
- previous_state: JSON (state before change)
- new_state: JSON (state after change)
- metadata: JSON (contextual information)
- event_timestamp: timestamp
- correlation_id: string
```

## Duplicate Detection

The system prevents duplicate message storage through:

1. **File Uniqueness Check**: Using Telegram's `file_unique_id` as a stable identifier
2. **Database Lookup**: Checking if file has been previously processed
3. **Smart Reuse**: If duplicate is detected:
   - Uses existing storage path and file information
   - Updates message metadata if needed
   - Links to existing file rather than re-downloading

## Audit Logging

All operations are logged for traceability using the `unified_audit_logs` table:

1. **Event Tracking**:
   - Message creation/modification
   - Processing state changes
   - File operations
   - Analysis results
2. **Logging Context**:
   - Records both previous and new states
   - Tracks correlation IDs for request tracing
   - Preserves event timestamps
   - Maintains entity relationships

## Media Group Synchronization

For media groups (multiple files sent together):

1. **Group Detection**: Messages with the same `media_group_id` are linked
2. **Caption Propagation**: Caption from one message can be applied to all group members
3. **Shared Analysis**: Product data extracted from caption is synchronized
4. **Edit Consistency**: Edits to one group member can propagate to others

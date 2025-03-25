
# Telegram Webhook System: Quick Overview

## Core Functionality

The Telegram webhook system receives, processes, and stores messages from Telegram in the following database tables:
- `messages` - for media content (photos, videos, documents)
- `other_messages` - for text-only messages
- `unified_audit_logs` - for tracking all operations

## Message Flow

1. **Webhook Receives Message** (`index.ts`)
   - Determines message type and context
   - Routes to appropriate handler

2. **Media Messages** (`mediaMessageHandler.ts`)
   - Downloads media from Telegram API
   - Stores in Supabase Storage
   - Records metadata in database
   - Processes caption for product data

3. **Text Messages** (`textMessageHandler.ts`)
   - Stores in `other_messages` table
   - Simpler processing with minimal metadata

4. **Edited Messages** (`editedMessageHandler.ts`)
   - Tracks version history
   - Updates content while preserving history
   - Handles both caption and media changes
   - Reprocesses captions when edited

## Key Features

### Media Handling
- **Efficient Storage**: Uses Telegram's `file_unique_id` as stable identifier
- **Duplicate Detection**: Avoids re-downloading already processed files
- **Retry Logic**: Robust download with exponential backoff for failures
- **File Recovery**: Can redownload missing files from Telegram
- **Simplified Validation**: Permissive file ID validation to accommodate Telegram API changes
- **Fallback Strategies**: Checks existing storage before failing download operations

### Message Groups
- Groups related media with `media_group_id`
- Synchronizes captions across group members
- Propagates edits to entire group

### Forward Detection
- Tracks origin of forwarded messages
- Maintains relationship to original message
- Records forward source metadata

### Audit Trail
- Complete logging of all operations
- Change tracking for debugging
- Correlation IDs for request tracing

## Processing States
- `pending` → `processing` → `completed` or `error`
- Failed messages can be reprocessed

## Database Organization

```
messages ──┬── media content
           ├── processing state
           ├── analyzed product data
           ├── storage references
           └── edit history

other_messages ─┬── text content
                ├── processing state
                └── edit history

unified_audit_logs ─┬── operations log
                    ├── state changes
                    └── error tracking
```

## Media Storage Structure
- Bucket: `telegram-media`
- Path format: `[file_unique_id].[extension]`
- Public URLs provided for frontend access

## Troubleshooting

### File ID Validation
- Telegram file IDs are treated permissively to accommodate API changes
- Only basic sanitization (trimming) is applied to file IDs
- Detailed error logs help identify API issues when they occur

### Media Download Issues
- If direct download from Telegram fails, system checks if file exists in storage
- File accessibility errors are usually due to expired file IDs (Telegram limits access time)
- Media can be manually reprocessed using the `reuploadMediaFromTelegram` function

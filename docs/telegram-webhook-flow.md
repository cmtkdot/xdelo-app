# Telegram Webhook Processing Flow

## Comprehensive System Overview

```mermaid
flowchart TD
    A[Telegram Webhook] --> B[Unified Handler]
    B --> C{Message Type?}
    C -->|Media| D[Media Handler]
    C -->|Text| E[Text Handler]
    C -->|Edit| F[Edit Handler]

    D --> G[Process Media]
    G --> H[Call handle_media_message RPC]
    H --> I[Database Operations]

    E --> J[Call handle_text_message RPC]
    J --> I

    F --> K[Call handle_message_edit RPC]
    K --> I

    I --> L[Trigger Processing]
    L --> M[Caption Parser]
    M --> N[Update Analyzed Content]
    N --> O[Sync Media Groups]
```

## Detailed Message Processing Flow

```mermaid
sequenceDiagram
    participant Telegram
    participant Webhook
    participant MediaHandler
    participant TextHandler
    participant EditHandler
    participant MediaStorage
    participant Database
    participant CaptionParser

    Telegram->>Webhook: POST Message Update
    Webhook->>MediaHandler: Route Media Message
    MediaHandler->>MediaStorage: Download/Store Media
    MediaStorage-->>MediaHandler: Storage Path
    MediaHandler->>Database: Call handle_media_message
    Database->>Database: Check Duplicates
    Database->>Database: Insert/Update Message
    Database-->>MediaHandler: Result
    MediaHandler-->>Webhook: Response
    Webhook-->>Telegram: 200 OK

    Database->>CaptionParser: Trigger Processing
    CaptionParser->>Database: Lock Message
    CaptionParser->>CaptionParser: Parse Caption
    CaptionParser->>Database: Update Analyzed Content
    CaptionParser->>Database: Sync Media Groups
```

## Caption Parsing Flowchart

```mermaid
flowchart TD
    A[Start] --> B[Receive Caption]
    B --> C{Valid Caption?}
    C -->|Yes| D[Extract Product Name]
    C -->|No| E[Return Error]
    D --> F[Extract Product Code]
    F --> G[Extract Vendor ID]
    G --> H[Parse Purchase Date]
    H --> I[Detect Quantity]
    I --> J[Extract Notes]
    J --> K[Validate Fields]
    K --> L{Valid?}
    L -->|Yes| M[Return Parsed Content]
    L -->|No| N[Flag Missing Fields]
    N --> O[Return Partial Result]
```

## Error Handling Flow

```mermaid
stateDiagram-v2
    [*] --> Initialized
    Initialized --> Pending: Caption exists
    Pending --> Processing: Lock acquired
    Processing --> Completed: Parse success
    Processing --> Error: Parse failed
    Error --> Pending: Manual retry
    Completed --> Pending: Edit received
    Processing --> Pending: Timeout
```

## Database Schema Relationships

```mermaid
erDiagram
    MESSAGES ||--o{ MESSAGE_EDIT_HISTORY : "1:N"
    MESSAGES {
        uuid id PK
        bigint telegram_message_id
        bigint chat_id
        text caption
        jsonb analyzed_content
        text processing_state
        text file_unique_id
        uuid media_group_id
        uuid duplicate_reference_id
    }
    MESSAGE_EDIT_HISTORY {
        uuid id PK
        uuid message_id FK
        text previous_caption
        text new_caption
        timestamp edited_at
    }
    MEDIA_GROUPS {
        uuid id PK
        text status
        timestamp processed_at
    }
```

## Key Components

### Edge Functions
- `telegram-webhook`: Main entry point with routing logic
- `parse-caption`: Processes captions in background
- `media-management`: Handles file operations

### Shared Utilities
- `captionParser.ts`: Advanced parsing with:
  ```typescript
  interface ParsedContent {
    product_name: string
    product_code: string
    vendor_uid: string | null
    purchase_date: string | null
    quantity: number | null
    notes: string
    parsing_metadata: {
      method: 'manual' | 'ai'
      timestamp: string
      missing_fields?: string[]
    }
  }
  ```
- `mediaStorage.ts`: Secure file handling
- `auditLogger.ts`: Centralized logging

### Database Functions
| Function | Purpose |
|----------|---------|
| `handle_media_message` | Core media processing |
| `handle_message_edit` | Edit handling |
| `xdelo_sync_media_group_content` | Group synchronization |

## Processing States

```mermaid
journey
    title Message Lifecycle
    section New Message
      Initialized: 5: Webhook
      Pending: 3: Trigger
      Processing: 4: Parser
      Completed: 5: Success
    section Edited Message
      Completed: 3: Webhook
      Pending: 4: Trigger
      Processing: 3: Parser
      Completed: 5: Success
    section Error
      Error: 2: Parser
      Pending: 3: Retry
```

## Retry Mechanism

```mermaid
gantt
    title Retry Timeline
    dateFormat  HH:mm
    section Message
    Initial Attempt :a1, 09:00, 5m
    First Retry :a2, after a1, 5m
    Second Retry :a3, after a2, 5m
    Final Attempt :a4, after a3, 5m
    section System
    Backoff : 09:00, 15m
# Telegram Webhook Processing Flow

This document outlines the architecture, data flow, and components of the Telegram webhook system.

## Overview

The Telegram webhook system processes incoming messages from Telegram and stores them in the database. It implements sophisticated duplicate handling with these cases:

1. Exact Duplicate (same telegram_message_id + chat_id):
   - Skip processing, update last_seen_at timestamp
2. File Duplicate (same file_unique_id):
   - Insert new message record but reuse existing storage_path/public_url
   - Link via duplicate_reference_id to original
   - Update original's metadata to note duplicate count
3. New Message/File:
   - Insert new record and process normally

Additional handling includes:
1. Media messages (photos, videos, documents)
2. Text messages
3. Caption parsing and analysis
4. Media group synchronization
5. Forwarded messages
6. Edited messages

## Architecture Components (Hybrid Plan)

### Edge Functions

| Function                     | Purpose                                                                                               | Status | Notes                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| `telegram-webhook`           | Main entry point for Telegram updates. Routes messages to handlers.                                   | Active | -                                |
| `parse-caption`             | **Core processing engine.** Polls for 'pending' messages, parses captions, updates DB, triggers sync. | Active | Uses enhanced parsing logic from `parse-caption` function. |
| `media-management`           | Handles media file operations (download/upload).                                                      | Active | Called by `telegram-webhook`.    |
| `xdelo_unified_media_repair` | Repairs missing or corrupted media.                                                                   | Active | Separate utility/process.        |

### Shared Code

| Module                        | Purpose                                                   | Location            |
| ----------------------------- | --------------------------------------------------------- | ------------------- |
| `captionParser.ts`            | Contains enhanced `xdelo_parseCaption` function with detailed logging and error handling. | `_shared/`          |
| `consolidatedMessageUtils.ts` | Shared utilities for metadata extraction, logging, etc.   | `_shared/`          |
| `dbOperations.ts`             | DB interaction helpers for `telegram-webhook`. Implements upsert pattern for message handling. | `telegram-webhook/` |
| `mediaStorage.ts`             | Media download/upload logic.                              | `_shared/`          |

### Database Functions

| Function                            | Purpose                                                           | Status | Notes                                   |
| ----------------------------------- | ----------------------------------------------------------------- | ------ | --------------------------------------- |
| `xdelo_extract_telegram_metadata`   | Extracts essential data from telegram_data JSON.                  | Active | Called by DB triggers.                  |
| `xdelo_set_caption_pending_trigger` | Sets `processing_state` to 'pending' for messages with captions.  | Active | Called by `trg_process_caption`.        |
| `xdelo_sync_media_group_content`    | Synchronizes `analyzed_content` across media group members.       | Active | Called by `direct-caption-processor`.   |
| `xdelo_recheck_media_groups`        | Safety net: Periodically finds & fixes inconsistent media groups. | Active | Called by `pg_cron`.                    |
| `xdelo_sync_incomplete_media_group` | Helper for `xdelo_recheck_media_groups`.                          | Active | Called by `xdelo_recheck_media_groups`. |
| `xdelo_reset_stalled_messages`      | Safety net: Periodically resets messages stuck in 'processing'.   | Active | Called by `pg_cron`.                    |
| `set_public_url`                    | Generates public URLs for stored media.                           | Active | Called by `set_public_url` trigger.     |

### Database Triggers

| Trigger                           | Function                            | Event                           | Purpose                                    | Status | Notes                   |
| --------------------------------- | ----------------------------------- | ------------------------------- | ------------------------------------------ | ------ | ----------------------- |
| `trg_process_caption`             | `xdelo_set_caption_pending_trigger` | BEFORE INSERT/UPDATE OF caption | Sets state to 'pending' if caption exists. | Active | Core part of new flow.  |
| `set_public_url`                  | `set_public_url`                    | BEFORE INSERT/UPDATE            | Generates public URLs.                     | Active | Unchanged.              |
| `trg_handle_telegram_data_insert` | `handle_telegram_data_insert`       | BEFORE INSERT                   | Sets telegram_metadata                     | Active | Extracts metadata.      |
| `trg_handle_telegram_data_update` | `handle_telegram_data_update`       | BEFORE UPDATE                   | Updates telegram_metadata                  | Active | Keeps metadata in sync. |

## Data Flow (Hybrid Plan)

### Overall Message Flow

```mermaid
sequenceDiagram
    participant T as Telegram
    participant W as telegram-webhook
    participant DB as Database (Messages Table)
    participant TRG as trg_process_caption
    participant EF as direct-caption-processor
    participant P as _shared/captionParser.ts
    participant SYNC as xdelo_sync_media_group_content (DB Fn)

    T->>W: Message Update (New/Edit)
    W->>DB: Check for existing message (telegram_message_id + chat_id)
    alt Exact Duplicate Found
        W->>DB: Update last_seen_at only
        DB-->>W: Update Complete
    else File Duplicate (file_unique_id exists)
        W->>DB: Insert new message with duplicate_reference_id
        W->>DB: Reuse storage_path/public_url from original
        W->>DB: Update original's duplicate_count
        Note over DB,TRG: IF caption exists/changed THEN trigger fires
        TRG->>DB: Set state='pending', start_time=NOW()
        DB-->>W: Insert Complete (Message ID)
    else New Message
        W->>DB: createMessage() (Full insert)
        Note over DB,TRG: IF caption exists/changed THEN trigger fires
        TRG->>DB: Set state='pending', start_time=NOW()
        DB-->>W: Insert Complete (Message ID)
    end
    W-->>T: Acknowledge Receipt (HTTP 200)

    Note right of EF: Runs periodically (e.g., cron/timer)
    EF->>DB: Query for state='pending' (Batch)
    DB-->>EF: Pending Message(s)
    loop For Each Pending Message
        EF->>DB: Atomic UPDATE state='processing' WHERE state='pending'
        alt Lock Successful
            EF->>P: xdelo_parseCaption(caption)
            P-->>EF: analyzedContent / Error
            alt Parse Success
                EF->>DB: UPDATE analyzed_content, state='completed'
                alt Is Media Group
                    EF->>SYNC: Call RPC(message_id, media_group_id)
                    SYNC->>DB: Update Group Members
                    SYNC-->>EF: Sync Result
                end
            else Parse Error
                EF->>DB: UPDATE state='error', error_message
            end
        else Lock Failed (Another instance processing)
            EF->>EF: Skip message
        end
    end
```

### Safety Net Flows

```mermaid
graph TD
    subgraph Stalled Message Reset
        CRON1[pg_cron Schedule] --> RF1[xdelo_reset_stalled_messages()]
        RF1 --> DB1[Query messages WHERE state='processing' AND started_at < timeout]
        DB1 --> RF1
        RF1 --> DB2[UPDATE state='pending']
    end

    subgraph Inconsistent Group Check
        CRON2[pg_cron Schedule] --> RF2[xdelo_recheck_media_groups()]
        RF2 --> DB3[Find groups with mixed states]
        DB3 --> RF2
        RF2 --> RF3[xdelo_sync_incomplete_media_group(group_id)]
        RF3 --> DB4[Find source message in group]
        DB4 --> RF3
        RF3 --> DB5[UPDATE incomplete messages in group]
    end
```

## Message Processing States (Hybrid Plan)

- `initialized`: Initial state after message is stored by webhook.
- `pending`: Caption exists, ready for processing by `direct-caption-processor`. Set by `trg_process_caption`.
- `processing`: Actively being processed by an instance of `direct-caption-processor`. Set by `direct-caption-processor`.
- `completed`: Processing and parsing successful. `analyzed_content` is populated. Set by `direct-caption-processor` or `xdelo_sync_media_group_content`.
- `error`: Processing failed. `error_message` field contains details. Set by `direct-caption-processor`.

## Metadata Extraction

- All incoming messages have their `telegram_metadata` extracted from the full `telegram_data` JSON.
- This extraction happens automatically via the `trg_handle_telegram_data_insert` and `trg_handle_telegram_data_update` triggers.
- The metadata extraction function `xdelo_extract_telegram_metadata` keeps only essential fields, reducing storage requirements.
- Having this metadata extracted makes queries faster and reduces load on the database.

## Error Recovery & Duplicate Handling

The system has multiple layers of error recovery and duplicate handling:

1. **Duplicate Detection**:
   - Exact matches (telegram_message_id + chat_id): Skip processing, update timestamp
   - File duplicates (file_unique_id): Reuse storage, track references
   - Media group duplicates: Link to existing group members

2. **Worker Pattern**:
   - The direct-caption-processor uses atomic updates to lock messages
   - Prevents duplicate processing of the same message

3. **Stalled Message Detection**:
   - pg_cron job periodically resets messages stuck in 'processing'
   - Configurable timeout threshold (default: 5 minutes)

4. **Media Group Consistency**:
   - Separate pg_cron job finds and fixes inconsistent groups
   - Ensures all group members have matching analyzed_content

5. **System Repair Tools**:
   - UI tools for manual reset of stuck messages
   - Ability to force reprocess specific messages
   - Tools to recheck and repair media groups

6. **Duplicate Recovery**:
   - Automatic handling of file_unique_id conflicts
   - Preserves original file storage while allowing new metadata
   - Tracks duplicate relationships via duplicate_reference_id

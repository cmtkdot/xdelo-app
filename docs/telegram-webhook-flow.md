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

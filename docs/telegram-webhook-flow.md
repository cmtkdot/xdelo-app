# Telegram Webhook Processing Flow

## Overview
[Previous content remains unchanged...]

## New: Edit History System

```mermaid
sequenceDiagram
    participant Telegram
    participant Handler
    participant DB
    Telegram->>Handler: Edited Message
    Handler->>DB: Get current edit_history
    DB-->>Handler: Existing history
    Handler->>Handler: Create new history entry
    Handler->>DB: Update with complete history
```

### Key Properties:
- Tracks all message edits (text, caption, media)
- Preserves previous states
- Includes timestamps and edit sources
- Used for auditing and recovery

### Edit History Item Structure:
```typescript
interface EditHistoryItem {
  timestamp: string; // ISO date
  previous_text?: string;
  previous_caption?: string;
  new_text?: string;
  new_caption?: string; 
  edit_source: 'telegram' | 'manual' | 'system';
  edit_date: string; // ISO date
}
```

## Enhanced: Media Group Synchronization

### Updated Sync Parameters:
```typescript
interface SyncOptions {
  forceSync: boolean; // Sync even single messages
  syncEditHistory: boolean; // Propagate edit history
}

// Example usage:
await syncMediaGroupContent(
  messageId,
  { 
    media_group_id: groupId,
    caption: message.caption 
  },
  { 
    forceSync: true,
    syncEditHistory: false 
  }
);
```

## New: Interface Transformations

### TelegramMessage → MessageRecord
```mermaid
flowchart LR
    A[TelegramMessage] --> B[Base Fields]
    A --> C[Media Processing]
    A --> D[Forward Info]
    B --> E[MessageRecord]
    C --> E
    D --> E
```

### Transformation Process:
1. Extract core message fields
2. Process media attachments (if any)
3. Handle forwarded message metadata
4. Build complete database record

## Updated: Data Flow Diagrams

### Edit Processing Flow
```mermaid
journey
    title Edit Message Processing
    section Receive
      Telegram: 5: Send edit
      Webhook: 5: Validate
    section Process
      History: 4: Update history
      Content: 4: Process changes
    section Sync
      MediaGroup: 3: Sync if needed
      Database: 3: Commit changes
```

[Previous sections about architecture, error handling etc. remain unchanged...]

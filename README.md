# xdelo-app - Telegram Message Processing System

## Knowledge Base

Telegram Webhook Entry Point (telegram-webhook/index.ts):

Receives webhook updates from Telegram
Generates a unique correlation ID for tracking
Determines message context (channel post, forwarded, edited)
Routes messages based on type:
Edited messages → handleEditedMessage
Media messages → handleMediaMessage
Other messages → handleOtherMessage
Media Message Handling (mediaMessageHandler.ts):

Duplicate Detection:

Checks for existing messages with same file_unique_id used for the name directly in the telegram-storage bucket 
Updates existing record if found instead of creating new one
Media Group Handling:

Recognizes messages part of a media group
Maintains relationships between grouped messages
Syncs the analyzed content across group members
Caption Processing:

Messages with captions go to manual-caption-parser
Falls back to database function if parser fails
Handles caption edits and removals
Processing States:

'initialized': Initial state for new messages
'pending': Ready for caption analysis
'completed': Successfully processed
'error': Processing failed
Media Group Synchronization:

Immediate sync after processing captions
Delayed re-checks for initially empty groups
Direct database fallback for reliability
Maintains edit history and caption relationships

detailed: 
Caption Processing and Media Group Synchronization
1. Caption Processing Flow --> If No caption then will check for other media groups that are the same and see if they have analyzed content parsed from caption already completed and not null. It will sync if it  has captions then: 
A. Entry Points
Direct Processing (Primary Path)
Webhook receives Telegram message
Message stored with initial state 'initialized'
Caption processor triggered immediately
Manual Processing (Secondary Path)

UI-triggered reprocessing
Force reprocessing flag set
Existing analysis preserved in history
B. Caption Analysis Algorithm
The system uses a sophisticated multi-pattern matching approach:

Simple Patterns

- Single Quantity: "14x"
- Basic Product: "Gelato Cake"
- Product with Quantity: "Mochi x 1"
Complex Patterns

- Standard Format: "Product Name #CODE x Quantity"
- Special Format: "Platinum #2 #HEFF022425 x 1 (30 + behind)"
- Multiline Format: Multiple lines with product name, code, and notes
Data Extraction

Product Name: Text before code/quantity
Product Code: Text following '#' with specific format
Vendor UID: First 1-4 letters of product code
Purchase Date: 6 digits after vendor code (mmDDyy)
Quantity: Numbers following 'x' or preceding 'x'
Notes: Text in parentheses
C. Partial Success Handling
Missing Field Detection

Tracks which fields couldn't be parsed
Allows operation to continue with partial data
Marks message with partial_success flag
Metadata Tracking


{
  "parsing_metadata": {
    "method": "manual",
    "partial_success": true,
    "missing_fields": ["quantity", "purchase_date"],
    "quantity_pattern": "x 4",
    "timestamp": "2024-03-10T..."
  }
}
2. Media Group Synchronization
A. Immediate Synchronization
Trigger Points

New message in group received
Caption edited
Force reprocessing requested
Synchronization Process


sequenceDiagram
    participant M as Message
    participant DB as Database
    participant S as Sync Function
    participant G as Media Group
    
    M->>DB: Update analyzed content
    DB->>S: Trigger sync
    S->>DB: Acquire advisory lock
    S->>G: Propagate content
    S->>DB: Update group metadata
    S->>DB: Release lock
B. Multi-Layer Fallback System
Primary Path

Edge function synchronization
Uses database transaction
Advisory locks prevent conflicts
Fallback Mechanisms

Edge Function → Direct DB Function → Manual Repair
Error Recovery

Transaction rollback on failure
Automatic retry with backoff
Error logging and monitoring
Manual repair tools
C. State Management
Message States

initialized → processing → completed/error
Group Metadata


{
  "group_message_count": 4,
  "group_first_message_time": "2024-03-10T...",
  "group_last_message_time": "2024-03-10T...",
  "is_original_caption": true,
  "group_caption_synced": true
}
Edit History Tracking


{
  "edit_history": [
    {
      "timestamp": "2024-03-10T...",
      "type": "edit",
      "previous_analyzed_content": {...}
    }
  ]
}
3. Error Handling and Recovery
A. Transaction Management
Critical Sections

Caption analysis
Group synchronization
State updates
Rollback Scenarios

Parse failures
Sync conflicts
Network issues
B. Monitoring and Maintenance
Health Checks

Processing state counts
Stalled messages
Mixed group states
Automated Repairs

Reset stalled processes
Clear stuck locks
Repair group inconsistencies
C. Manual Intervention Tools
UI Controls

Force reprocessing
Group repair
State reset
Diagnostic Functions

Message status query
Group consistency check
Processing history view

### Full System Architecture
```mermaid
flowchart LR
    subgraph Frontend
        A[React UI] --> B[Message Dashboard]
        A --> C[Media Viewer]
        A --> D[Audit Logs]
        B --> E[MessageControlPanel]
        B --> F[MessageList]
        C --> G[MediaRepairDialog]
        D --> H[SyncLogsTable]
    end
    
    subgraph Backend
        I[Telegram Webhook] --> J[Edge Functions]
        J --> K[Database Operations]
        K --> L[PostgreSQL]
        J --> M[Supabase Storage]
        L --> N[Audit Tables]
        M --> O[Media Files]
    end
    
    subgraph Services
        P[Telegram API] --> I
        Q[Scheduled Jobs] --> R[Auto-repair]
        Q --> S[Daily Maintenance]
    end
    
    Frontend -- REST API --> Backend
    Backend -- WebSocket --> Frontend
```

### Frontend Architecture

1. **Core Components**:
   - `MessageControlPanel`: Central hub for message operations
   - `MediaViewer`: Handles media display and repair workflows
   - `SyncLogsTable`: Real-time monitoring of sync operations

2. **State Management**:
   ```typescript
   // Example from useMessageQueue.ts
   const { messages, processingState, errorStats } = useMessageQueue({
     initialFilter: 'pending',
     refreshInterval: 15000,
     repairOptions: {
       autoRetry: true,
       maxAttempts: 3
     }
   });
   ```

3. **Key Flows**:
   - Media repair workflow with error recovery
   - Real-time message updates via Supabase subscriptions
   - Batch processing controls for large media groups

### End-to-End Workflow
```mermaid
sequenceDiagram
    participant User as Telegram User
    participant TG as Telegram API
    participant BE as Backend
    participant DB as Database
    participant FE as Frontend
    
    User->>TG: Send Media Message
    TG->>BE: Webhook Notification
    BE->>DB: Store Raw Message
    BE->>BE: Process Media
    BE->>DB: Update Analyzed Content
    DB->>FE: Real-time Update
    FE->>User: Display Processed Message
    FE->>BE: Initiate Repair (if needed)
    BE->>TG: Redownload Media
    BE->>DB: Update Fixed Record
```

### Key System Flows



```mermaid
graph TD
    A[Cloudflare] --> B[Edge Functions1. **Media Processing**:
   - Automatic MIME type detection/correction
   - Multi-phase storage validation
   - EXIF data stripping for security

2. **Caption Analysis**:
   - Pattern-based parsing with fallback to AI
   - Vendor code normalization
   - Historical version tracking

3. **Error Recovery**:
   - Automatic hash verification
   - Cross-service correlation ID tracing
   - Progressive backoff algorithm

### Deployment Architecture]
    B --> C[Supabase PostgreSQL]
    B --> D[Supabase Storage]
    C --> E[OLAP Reporting]
    D --> F[CDN Distribution]
    G[Telegram] --> B
    H[React Frontend] --> B
    H --> C
    H --> D
```

### Frontend Component Hierarchy
```mermaid
flowchart TD
    App --> Dashboard
    App --> Settings
    Dashboard --> MessageList
    Dashboard --> MediaGrid
    MessageList --> MessageCard
    MessageCard --> MediaPreview
    MessageCard --> AnalysisDetails
    MediaGrid --> MediaItem
    MediaItem --> RepairControls
    Settings --> SyncStatus
    Settings --> SystemTools
```

### Error Recovery Workflow
```mermaid
flowchart TD
    A[Error Detected] --> B{Retryable?}
    B -->|Yes| C[Increment Retry Count]
    C --> D{Under Limit?}
    D -->|Yes| E[Queue Retry]
    D -->|No| F[Mark Permanent Failure]
    B -->|No| F
    E --> G[Backoff Delay]
    G --> H[Re-process]
    F --> I[Alert Dashboard]
```

### Project Overview
A robust system for processing Telegram messages with media attachments, designed to:
- Extract structured product data from media captions
- Maintain media group synchronization
- Provide comprehensive audit logging
- Handle message edits and updates gracefully

**Core Technologies:**
- Supabase (PostgreSQL + Storage)
- Deno Edge Functions
- Telegram Bot API
- React Frontend

### Key Features
1. **Media Processing Pipeline**
   - Automatic media download from Telegram
   - Storage in Supabase with public URL generation
   - MIME type validation and correction

2. **Caption Analysis Engine**
   - Pattern-based product data extraction
   - Vendor UID detection from product codes
   - Purchase date parsing from multiple formats

3. **Audit System**
   - Unified logging of all system operations
   - Message edit history tracking
   - Correlation ID tracing across services

4. **Error Recovery**
   - Automatic media redownloads
   - Stalled message detection/reset
   - Media group consistency checks

### Design Guidelines
1. **Architecture Principles**
   - Direct processing over queued systems
   - Transaction-based database operations
   - Edge-function first approach

2. **Error Handling**
   - Automatic retries with exponential backoff
   - Partial success states for complex operations
   - Daily maintenance jobs for system health

3. **Code Standards**
   - TypeScript across all layers
   - SQL functions for complex data operations
   - React hooks for frontend state management

---

## Overview

This system processes Telegram messages with media and captions, extracting structured data while maintaining media group synchronization and audit logging. The system focuses on reliability and maintainability with direct processing instead of queues.

```mermaid
flowchart TD
    A[Telegram Message] --> B{Message Type}
    B -->|Media| C[Download & Store Media]
    B -->|Text| D[Process Text Content]
    B -->|Edited| E[Handle Edits]
    
    C --> F{Has Caption?}
    F -->|Yes| G[Parse Caption]
    F -->|No| H[Check Media Group]
    
    G --> I[Extract Product Data]
    I --> J[Store Analyzed Content]
    J --> K[Sync Across Media Group]
    
    H --> L{Group Has Analysis?}
    L -->|Yes| M[Sync From Group]
    L -->|No| N[Flag for Later]
    
    E --> O{Caption Changed?}
    O -->|Yes| P[Reset Analysis]
    O -->|No| Q[Preserve History]
```

## Key Components

### 1. Telegram Webhook Handler (`telegram-webhook`)
- Entry point for all Telegram updates
- Handles media downloads and storage
- Routes messages to appropriate processors
- Generates correlation IDs for tracing

### 2. Media Processing Pipeline
```typescript
// From mediaUtils.ts
export const processMediaMessage = async (message: TelegramMessage) => {
  const mediaInfo = await getMediaInfo(message);
  const dbRecord = await createMediaRecord(mediaInfo);
  
  if (mediaInfo.caption) {
    await triggerCaptionAnalysis(dbRecord.id, mediaInfo.correlationId);
  }
  
  return mediaInfo;
};
```

### 3. Caption Analysis System
- Pattern-based extraction of:
  - Product Name
  - Product Code
  - Vendor UID
  - Purchase Date
  - Quantity

### 4. Media Group Synchronization
```mermaid
sequenceDiagram
    participant M as Media Message
    participant D as Database
    participant S as Sync Service
    
    M->>D: Store initial message
    D->>S: Trigger media group check
    S->>D: Find group members
    S->>D: Sync analyzed content
    D->>D: Update all group members
```

### 5. Unified Audit Logging
```sql
-- From simplified-audit-logging.md
CREATE TABLE unified_audit_logs (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB,
  correlation_id TEXT,
  event_timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Processing States

| State | Description | Next Actions |
|-------|-------------|--------------|
| `pending` | Initial state after message receipt | Automatic processing |
| `processing` | Analysis in progress | Completion or error |
| `completed` | Successful processing | - |
| `error` | Failed processing | Automatic retries |

## Error Handling

### Retry Mechanism
```typescript
// From analysisHandler.ts
async function handleAnalysisError(messageId: string, error: Error) {
  await supabase
    .from('messages')
    .update({
      retry_count: supabase.sql`COALESCE(retry_count, 0) + 1`,
      last_error_at: new Date().toISOString()
    })
    .eq('id', messageId);

  if (retryCount < MAX_RETRIES) {
    await supabase
      .from('messages')
      .update({ processing_state: 'pending' })
      .eq('id', messageId);
  }
}
```

### Recovery Tools
1. `xdelo_redownload_missing_media` - Recover failed media
2. `xdelo_reset_stalled_messages` - Reset stuck messages
3. `xdelo_repair_media_group_syncs` - Fix group inconsistencies

## Deployment

### Environment Setup
```toml
# supabase/config.toml
[telegram]
bot_token = "YOUR_BOT_TOKEN"
api_id = "YOUR_API_ID"
api_hash = "YOUR_API_HASH"

[storage]
bucket_name = "telegram-media"
max_file_size = "20MB"
```

### Required Services
1. Supabase PostgreSQL
2. Supabase Storage
3. Telegram Bot API
4. Deno Edge Functions

## Documentation Structure

```
docs/
├── consolidated-functions.md      # Core database functions
├── direct-caption-processing.md   # Caption analysis details
└── simplified-audit-logging.md    # Audit system design
```

## Monitoring

Key metrics tracked:
1. Messages processed/minute
2. Error rate by category
3. Media group sync success rate
4. Average processing latency

```sql
-- From v_message_audit_trail
SELECT * FROM v_message_audit_trail
WHERE entity_id = 'message-uuid'
ORDER BY event_timestamp DESC;
```

## Maintenance

Scheduled jobs:
```cron
# Daily maintenance
0 3 * * * xdelo_daily_maintenance

# 5-minute retries
*/5 * * * * xdelo_process_pending_messages

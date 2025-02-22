# Telegram Bot Message Processing Flow

## 1. Core Processing Architecture

```mermaid
flowchart TD
    A[Telegram Update] --> B{Update Type}
    B -->|Message/Channel Post| C[Process Message]
    B -->|Edit| D[Process Edit]
    B -->|Member| E[Process Member]
    
    C --> F{Media Type}
    F -->|Photo/Video| G[Media Flow]
    F -->|Other| H[Other Flow]
    
    H --> I{Message Type}
    I -->|Text| J[Store in other_messages]
    I -->|Command| K[Process Command]
    I -->|Voice/Document| L[Store File ID]
    I -->|Contact/Location| M[Store Metadata]
    I -->|Sticker| N[Store Sticker Info]
    
    G --> O{Has Caption?}
    O -->|Yes| P[Process Caption]
    O -->|No| Q[Store Media]
    
    P --> R{Media Group?}
    R -->|Yes| S[Group Flow]
    R -->|No| T[Single Analysis]
    
    Q --> U{In Group?}
    U -->|Yes| V[Check Group]
    U -->|No| W[Mark Complete]
    
    V --> X{Has Analysis?}
    X -->|Yes| Y[Sync Content]
    X -->|No| Z[Wait for Caption]

    D --> AA{Media Type}
    AA -->|Media| AB[Update Media]
    AA -->|Other| AC[Update other_messages]

    E --> AD[Store Member Update]
```

## 2. Message Reception & Processing

### Update Type Detection
```typescript
// Actual implementation
const message = update.message || 
               update.channel_post || 
               update.edited_message ||
               update.edited_channel_post;

if (!message) {
  if (update.my_chat_member || update.chat_member) {
    return await handleChatMemberUpdate(supabase, memberUpdate, correlationId);
  }
}
```

### Message Type Classification
```typescript
function determineMessageType(message: TelegramMessage): TelegramOtherMessageType {
  if (message.text?.startsWith('/')) return 'command';
  if (message.text) return 'text';
  if (message.sticker) return 'sticker';
  if (message.voice) return 'voice';
  if (message.document) return 'document';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  return 'text';
}
```

## 3. Media Message Flow

### Media Processing States
```mermaid
stateDiagram-v2
    [*] --> initialized: New Media
    initialized --> pending: Has Caption
    pending --> processing: Analysis Start
    processing --> completed: Analysis Success
    processing --> error: Analysis Failure
    error --> pending: Retry < 3
    error --> failed: Retry ≥ 3
```

### Media Group Handling
```mermaid
flowchart TD
    A[Media Group Message] --> B{Has Caption?}
    B -->|Yes| C[Mark Original]
    B -->|No| D[Check Group]
    
    C --> E[Store Timing]
    E --> F[Update Count]
    F --> G[Analyze Caption]
    
    D --> H{Existing Analysis?}
    H -->|Yes| I[Sync Content]
    H -->|No| J[Wait]
```

## 4. Non-Media Message Flow

### Message Types and Processing
```mermaid
flowchart TD
    A[Other Message] --> B{Type Check}
    B -->|Text| C[Store Content]
    B -->|Command| D[Parse Command]
    B -->|Voice| E[Store File ID]
    B -->|Document| F[Store Metadata]
    B -->|Location| G[Store Coordinates]
    B -->|Contact| H[Store Contact]
    B -->|Sticker| I[Store Sticker]
    
    D --> J[Extract Args]
    D --> K[Store Command]
    
    E --> L[Store Duration]
    F --> M[Store File Info]
    
    C --> N[Mark Completed]
    K --> N
    L --> N
    M --> N
    G --> N
    H --> N
    I --> N
```

### State Management
- Simpler than media messages
- Usually marked as 'completed' immediately
- No complex processing or retries
- Command processing happens synchronously

## 5. Channel Post Handling

### Channel Media Posts
```mermaid
flowchart TD
    A[Channel Post] --> B{Media?}
    B -->|Yes| C[Media Flow]
    B -->|No| D[Other Flow]
    
    C --> E[Set Channel Flag]
    E --> F[Process Media]
    
    D --> G[Store as Other]
    G --> H[Mark Complete]
```

### Channel Post States
- Identical to regular message states
- Additional flag: is_channel_post
- Special handling for edited channel posts

## 6. Edit Handling

### Edit Types
```mermaid
flowchart TD
    A[Edit Update] --> B{Message Type}
    B -->|Media| C[Update Media]
    B -->|Other| D[Update Other]
    
    C --> E{Caption Change?}
    E -->|Yes| F[Reprocess]
    E -->|No| G[Update Metadata]
    
    D --> H[Update Content]
    D --> I[Mark Edited]
```

### Edit Processing
- Track edit history
- Handle caption changes
- Update processing state if needed
- Maintain group synchronization

## 7. Database Structure

### Tables Overview
1. **messages**
   - Media content
   - Processing states
   - Group handling
   - Analysis results

2. **other_messages**
   - Non-media content
   - Command data
   - Member updates
   - Simple states

3. **message_state_logs**
   - State transitions
   - Timestamps
   - Previous states

4. **webhook_logs**
   - Event tracking
   - Error logging
   - Correlation IDs

## 8. Monitoring & Recovery

### Monitoring Views
```sql
CREATE MATERIALIZED VIEW message_flow_logs AS
SELECT 
  m.id,
  m.processing_state,
  m.created_at,
  wl.event_type,
  sl.previous_state,
  sl.new_state
FROM messages m
LEFT JOIN webhook_logs wl
LEFT JOIN message_state_logs sl;
```

### Error Recovery
```sql
-- Reset stuck messages
UPDATE messages SET
  processing_state = 'initialized',
  retry_count = COALESCE(retry_count, 0) + 1
WHERE 
  processing_state IN ('processing', 'pending')
  AND processing_started_at < NOW() - interval '15 minutes'
  AND retry_count < 3;
```

## 9. Integration Points

### External Services
1. **Telegram Bot API**
   - Message reception
   - File downloads
   - Command responses

2. **Storage Service**
   - Media storage
   - File management
   - URL generation

3. **AI Analysis**
   - Caption processing
   - Product extraction
   - Metadata analysis

### Database Functions
```sql
-- Key functions
CREATE OR REPLACE FUNCTION xdelo_update_message_processing_state();
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content();
CREATE OR REPLACE FUNCTION xdelo_handle_media_group_sync();
```

## 10. Security & Access Control

### RLS Policies
```sql
-- Messages table
CREATE POLICY "Enable full access for authenticated users" 
ON public.messages FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Other messages table
CREATE POLICY "Enable full access for authenticated users" 
ON public.other_messages FOR ALL TO authenticated
USING (true) WITH CHECK (true);
```

### Function Security
```sql
-- All processing functions use SECURITY DEFINER
CREATE OR REPLACE FUNCTION process_message()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  -- Function body
$$;
``` 
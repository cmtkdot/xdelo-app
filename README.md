# Sync Harmony: Telegram Media Collection & Product Management System

## System Flow Overview

```mermaid
flowchart TD
    A[Telegram Webhook] -->|Edge Function: telegram-webhook| B[messages Table]
    B -->|Has caption| C[Edge Function: parse-caption-with-ai]
    C -->|Store result| B

    B -->|Media Group| D{Check Media Type}
    D -->|Has media_group_id| E[Edge Function: sync-media-group-caption]
    D -->|Single media| F[Edge Function: sync-media-group-analysis]

    E -->|Find caption holder| G[Copy AI Analysis]
    G -->|Update all group items| B

    E & F -->|Download media| H[Storage: telegram-media]
    H -->|Update media data| B

    B -->|Trigger: handle_sync_retry| I[Retry Failed Syncs]
    I -->|Max 3 attempts| E

    B -->|Trigger: log_analysis_event| J[analysis_audit_log]
```

## Core Components

### Edge Functions

1. `telegram-webhook`
   - Validates and processes incoming Telegram updates
   - Handles message deduplication
   - Stores messages with proper JSONB handling

2. `parse-caption-with-ai`
   - Uses OpenAI for caption analysis
   - Extracts product details (name, quantity, vendor)
   - Handles confidence scoring

3. `sync-media-group-caption`
   - Manages media group synchronization
   - Propagates analysis across group members
   - Handles retry mechanisms

### Database Structure

1. `messages` Table
   - Stores message data and analysis results
   - Handles media groups and caption relationships
   - Tracks processing state and retry attempts

2. `analysis_audit_log` Table
   - Tracks analysis events and changes
   - Stores processing metadata
   - Enables debugging and monitoring

### Key Features

1. Media Processing
   - Automatic media download and storage
   - Thumbnail generation
   - Group synchronization
   - Retry mechanism for failed operations

2. Content Analysis
   - AI-powered caption parsing
   - Confidence scoring
   - Vendor and product identification
   - Quantity extraction

3. User Interface
   - Responsive product gallery
   - Advanced filtering capabilities
   - Media group navigation
   - Mobile-optimized layout

### Error Handling

- Automatic retry for failed syncs (max 3 attempts)
- Detailed error logging
- Processing state tracking
- Group-level synchronization recovery

### Monitoring

- Analysis audit logging
- Processing state tracking
- Media group sync status
- Error rate monitoring

For detailed technical documentation and API references, please refer to the respective component directories.
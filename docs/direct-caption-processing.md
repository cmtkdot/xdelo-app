
# Direct Caption Processing Flow

This document explains in detail how the direct caption processor works in the Telegram webhook system.

## Overview

The direct caption processor is responsible for analyzing captions from Telegram messages without using a queue system. It processes captions in real-time, using database transactions to ensure data consistency.

## Flow Diagram

```mermaid
sequenceDiagram
    participant T as Telegram
    participant W as Webhook
    participant D as Database
    participant P as Direct Caption Processor
    participant M as Manual Parser
    participant S as Media Group Sync

    T->>W: Send Message
    W->>D: Store Message
    D->>P: Trigger Processing (DB Trigger)
    P->>P: Begin Transaction
    P->>M: Parse Caption
    M->>P: Return Analyzed Content
    P->>D: Update Message
    alt Has Media Group
        P->>S: Sync Media Group
        S->>D: Update Group Messages
    end
    P->>P: Commit Transaction
    P->>D: Log Audit Events
```

## Triggering Mechanisms

The direct caption processor can be triggered in several ways:

1. **Database Trigger**: Automatically fires when a message with a caption is inserted or updated
2. **Edge Function**: Can be called manually via the `direct-caption-processor` edge function
3. **Scheduled Process**: Periodic job that finds pending messages and processes them

## Processing Steps

### 1. Initialization

When a message with a caption is detected:

- A correlation ID is assigned if not already present
- The message is marked as "processing"
- A transaction is begun using `xdelo_begin_transaction()`

### 2. Caption Analysis

The caption is analyzed using a multi-step approach:

1. **Pattern Matching**: 
   - Extract product name (text before '#')
   - Extract product code (text following '#')
   - Extract vendor UID (first 1-4 letters of product code)
   - Extract purchase date (parse date portion from product code)
   - Extract quantity (number following 'x' or similar indicators)

2. **Result Storage**:
   - Analyzed results are stored in a structured JSONB object
   - Includes all extracted fields and parsing metadata
   - Transaction prevents partial updates

### 3. Media Group Handling

If the message is part of a media group:

- The message is marked as the original caption holder (`is_original_caption = true`)
- Advisory locks prevent concurrent updates to the same media group
- The analyzed content is synchronized to all messages in the group
- Group metadata is updated with message counts and timestamps

### 4. Transaction Completion

After processing:

- The transaction is committed using `xdelo_commit_transaction_with_sync()`
- The message state is set to "completed"
- All changes are logged to the unified audit log

## Error Handling

If an error occurs during processing:

1. **Transaction Rollback**:
   - The transaction is rolled back to maintain consistency
   - The message is marked with error state
   - Error details are logged

2. **Automatic Retry**:
   - Failed messages can be automatically retried
   - Retry count is tracked in the message record
   - Maximum retry attempts prevent endless loops

## Recovery Mechanisms

For handling edge cases and failures:

1. **Manual Reprocessing**:
   - The `handleReanalyze` function allows manual reprocessing of a message
   - Bypasses normal flow and forces direct processing

2. **Stalled Message Recovery**:
   - The `xdelo_reset_stalled_messages()` function identifies and resets messages stuck in "processing" state
   - Daily maintenance job automatically resets stalled messages

3. **Media Group Repair**:
   - The `xdelo_repair_media_group_syncs()` function fixes inconsistencies in media groups
   - Identifies groups with mixed processing states and repairs them

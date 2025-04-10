# Media Group Consistency Cron Job

This Edge Function runs on a schedule to identify and fix inconsistencies in media group messages. It specifically targets media groups where some messages have `analyzed_content` while others don't, ensuring all messages within the same group have consistent caption and analysis data.

## Overview

The cron job:

1. Finds media groups with inconsistent `analyzed_content` (some messages have it, others don't)
2. Identifies the best source message to use as a reference (prioritizing messages with captions)
3. Uses the `sync_media_group_captions` function to synchronize all messages in each group
4. Records all operations to the `unified_audit_logs` table for monitoring

## Schedule

This function is configured to run daily at 03:00 AM server time.

## Configuration

```toml
# supabase/functions/media_group_sync_cron/config.toml
schedule = "0 3 * * *"  # Daily at 3am
```

## Response Format

The function returns a JSON response with:

```json
{
  "success": true,
  "groupsProcessed": 5,
  "totalMessagesUpdated": 12,
  "details": [
    {
      "mediaGroupId": "abc123",
      "messagesUpdated": 3,
      "sourceMessageId": "550e8400-e29b-41d4-a716-446655440000"
    },
    ...
  ],
  "timestamp": "2025-04-10T10:00:00.000Z"
}
```

## Dependencies

- Uses `find_inconsistent_media_groups` database function to identify targets
- Uses `sync_media_group_captions` function to synchronize groups
- Records operations using `unified_audit_logs` table

## Authorization

Function requires a valid service role key for execution.

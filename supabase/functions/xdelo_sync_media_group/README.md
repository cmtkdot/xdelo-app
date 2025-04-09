# xdelo_sync_media_group Edge Function

This edge function synchronizes analyzed content from a source message to all other messages in the same media group.

## Function Documentation

```typescript
/**
 * Syncs analyzed content from a source message to all other messages in the same media group
 * 
 * @function handleMediaGroupSync
 * @param {Request} req - The HTTP request object
 * @returns {Response} HTTP response with sync results
 * 
 * @description
 * This function takes a source message ID and media group ID, then copies the analyzed
 * content from the source message to all other messages in the same group. It's used
 * to ensure consistent analysis across all messages in a media group.
 * 
 * @example
 * // Basic usage
 * const response = await fetch('/functions/v1/xdelo_sync_media_group', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     mediaGroupId: 'media_group_123',
 *     sourceMessageId: 'msg_456'
 *   })
 * });
 * 
 * // With all options
 * const response = await fetch('/functions/v1/xdelo_sync_media_group', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     mediaGroupId: 'media_group_123',
 *     sourceMessageId: 'msg_456',
 *     correlationId: 'corr_789', // Optional tracking ID
 *     forceSync: true,           // Optional force sync even if already synced
 *     syncEditHistory: true      // Optional sync edit history as well
 *   })
 * });
 */
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mediaGroupId` | string | Yes | The ID of the media group to sync |
| `sourceMessageId` | string | Yes | The ID of the source message containing the analyzed content |
| `correlationId` | string | No | Optional tracking ID for logging (defaults to random UUID) |
| `forceSync` | boolean | No | Whether to force sync even if messages are already synced (defaults to false) |
| `syncEditHistory` | boolean | No | Whether to also sync edit history and old analyzed content (defaults to false) |

## Return Value

Returns a JSON response with the following structure:

### Success Response

```json
{
  "success": true,
  "synced_count": 3,
  "source_message_id": "msg_456",
  "media_group_id": "media_group_123"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message details",
  "media_group_id": "media_group_123"
}
```

## Edge Cases

- If no other messages exist in the media group, returns success with `synced_count: 0`
- If source message has no analyzed content, returns an error
- If any individual message update fails, it's logged but doesn't stop the overall process

## Dependencies

- Uses `xdelo_findMediaGroupMessages` from `_shared/messageUtils.ts`
- Requires Supabase client with appropriate permissions

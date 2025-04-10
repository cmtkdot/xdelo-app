# Database Changes Documentation - April 9, 2025

## Overview

This document details the database schema and stored procedure changes implemented on April 9, 2025, to resolve issues with media processing in the Telegram webhook functionality. The changes address three primary issues:

1. Foreign key constraint violations in the `unified_audit_logs` table
2. Chat type enum validation errors
3. User ID type mismatches

## 1. Unified Audit Logs Foreign Key Constraint Removal

### Problem

The `unified_audit_logs` table had a foreign key constraint requiring all `entity_id` values to reference existing records in the `messages` table. This caused failures when:
- Logging system-level events not associated with specific messages
- Logging events that occur before message creation
- Attempting to use generated UUIDs for invalid entity IDs

### Solution

We removed the foreign key constraint to allow more flexible logging:

```sql
-- Migration: 20250409_remove_audit_logs_fk_constraint.sql
ALTER TABLE public.unified_audit_logs
DROP CONSTRAINT IF EXISTS fk_unified_audit_logs_messages;

COMMENT ON TABLE public.unified_audit_logs IS 'Audit logs for all system events. The entity_id field can reference messages but is not required to.';
```

### Impact

- The system can now log any event with any UUID, even if it doesn't reference an existing message
- System-level logs can be stored in the same table as message-specific logs
- This maintains a unified logging approach while providing more flexibility

## 2. Chat Type Enum Validation

### Problem

The `chat_type` column in the `messages` table is a PostgreSQL enum type (`telegram_chat_type`) with specific allowed values:
- 'private'
- 'group'
- 'supergroup'
- 'channel'
- 'unknown'

The error occurred because raw text values from Telegram were being inserted directly without validation.

### Solution

We updated the `upsert_media_message` stored procedure to properly validate chat types:

```sql
-- Migration: 20250409_fix_chat_type_validation.sql
-- Declare variables
v_raw_chat_type TEXT;
v_chat_type public.telegram_chat_type;

-- Extract chat type from message data
v_raw_chat_type := p_message_data->'chat'->>'type';

-- Validate chat type - make sure it's one of the allowed enum values
CASE lower(v_raw_chat_type)
  WHEN 'private' THEN v_chat_type := 'private'::public.telegram_chat_type;
  WHEN 'group' THEN v_chat_type := 'group'::public.telegram_chat_type;
  WHEN 'supergroup' THEN v_chat_type := 'supergroup'::public.telegram_chat_type;
  WHEN 'channel' THEN v_chat_type := 'channel'::public.telegram_chat_type;
  ELSE v_chat_type := 'unknown'::public.telegram_chat_type;
END CASE;
```

### Impact

- Maintains type safety while handling all possible input values
- Provides a fallback to 'unknown' for unrecognized chat types
- Ensures data consistency and prevents type conversion errors
- No schema changes required - just improved validation logic

## 3. User ID Type Mismatch

### Problem

The `user_id` column in the `messages` table is defined as a UUID, but Telegram provides user IDs as integers (bigint). This caused type mismatch errors during message insertion.

### Solution

Since the `user_id` field was not essential for message processing, we removed references to it in the database operations:

```sql
-- Migration: 20250409_remove_user_id_usage_fixed.sql
-- In update operations:
UPDATE public.messages
SET 
  telegram_message_id = p_telegram_message_id,
  chat_id = p_chat_id,
  chat_type = v_chat_type,
  chat_title = v_chat_title,
  -- user_id = p_user_id, -- Removed user_id assignment
  ...
WHERE id = v_message_id;

-- In insert operations:
INSERT INTO public.messages (
  telegram_message_id,
  chat_id,
  chat_type,
  chat_title,
  -- user_id, -- Removed user_id from fields
  ...
) VALUES (
  p_telegram_message_id,
  p_chat_id,
  v_chat_type,
  v_chat_title,
  -- p_user_id, -- Removed user_id from values
  ...
)
```

### Impact

- Simplified the data model by removing an unnecessary field
- Resolved type mismatch errors without schema changes
- Maintained backward compatibility by keeping the parameter in the function signature
- Reduced potential for future type mismatch errors

## Implementation Details

All changes were implemented using Supabase migrations and follow these best practices:

1. **Backward Compatibility**: Existing code continues to function with these changes
2. **Type Safety**: We maintain strong typing through proper validation
3. **Separation of Concerns**: Data validation happens at the database level
4. **Documentation**: Changes are documented with clear rationale and implementation details

## TypeScript Interface Changes

No TypeScript interface changes were required as the modifications were made at the database level. The existing interfaces in the codebase remain valid.

## Testing

After applying these migrations, the following error scenarios were resolved:

```
Error: column "chat_type" is of type telegram_chat_type but expression is of type text
Error: Failed to create message: column "user_id" is of type uuid but expression is of type bigint
Error: insert or update on table "unified_audit_logs" violates foreign key constraint "fk_unified_audit_logs_messages"
```

## Next Steps

1. Monitor logs for any new validation errors
2. Consider if there are other similar type validation issues in other database functions
3. Review application code to ensure it aligns with these database changes

## API References

These changes affect the following database functions:

```typescript
/**
 * Creates or updates a media message in the database.
 * This function will validate the chat_type to ensure it's a valid enum value
 * and will ignore the user_id parameter to avoid type mismatches.
 * 
 * @param {object} params - The parameters for the media message
 * @param {bigint} params.telegram_message_id - The Telegram message ID
 * @param {bigint} params.chat_id - The Telegram chat ID
 * @param {string} params.file_unique_id - Unique ID of the file from Telegram
 * @param {string} params.chat_type - Type of chat (will be validated to match enum)
 * @param {string} [params.user_id] - User ID (now ignored in database operations)
 * @returns {Promise<string>} - UUID of the created or updated message
 * 
 * @example
 * // Using the function from TypeScript
 * const messageId = await supabaseClient.rpc('upsert_media_message', {
 *   p_telegram_message_id: 12345,
 *   p_chat_id: 67890,
 *   p_file_unique_id: 'abc123',
 *   p_message_data: { chat: { type: 'supergroup' } }
 *   // other parameters...
 * });
 */
```

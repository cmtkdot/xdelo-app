# Telegram Message Deletion System

This document provides an in-depth explanation of the complete message deletion flow implemented in the xdelo-app, covering database functions, edge functions, triggers, migrations, and frontend components.

## Table of Contents

1. [Overview](#overview)
2. [Complete Deletion Flow](#complete-deletion-flow)
3. [Database Components](#database-components)
4. [Edge Functions](#edge-functions)
5. [Frontend Components](#frontend-components)
6. [Migrations](#migrations)
7. [Row Level Security](#row-level-security)
8. [Troubleshooting](#troubleshooting)
9. [Testing](#testing)

## Overview

The message deletion system provides a robust flow for deleting messages from both Telegram and the database, with these key features:

- **Data Preservation**: Archives messages before deletion in a dedicated `deleted_messages` table
- **Media Group Handling**: Properly deletes all messages in a media group
- **Storage Cleanup**: Removes associated files from storage with automatic retry
- **Safety Net**: Database triggers ensure messages are archived even if bypassing the frontend
- **Resilience**: Handles failures gracefully with correlation IDs for tracking
- **Security**: Proper RLS policies ensure only authenticated users can perform operations

## Complete Deletion Flow

### Path 1: Frontend-Initiated Deletion (Both Telegram & Database)

1. **User Initiates Deletion**
   - User clicks delete on a message in the UI
   - `DeleteConfirmationDialog` shows with two options: "Delete from Database Only" or "Delete from Both"
   - User selects "Delete from Both"

2. **Archiving Phase**
   - `useTelegramOperations.deleteMessage(message, true)` is called
   - Function calls Supabase RPC function `x_archive_message_for_deletion(message_uuid)`
   - Database creates archive records in `deleted_messages` table for the message and all related media group messages

3. **Telegram Deletion Phase**
   - `deleteTelegramMessage()` is called which invokes the `delete-telegram-message` edge function
   - Edge function deletes the message from Telegram
   - If it's part of a media group, all related messages are also deleted from Telegram

4. **Database Deletion Phase**
   - After successful Telegram deletion, `deleteFromDatabase()` is called
   - This triggers the database `BEFORE DELETE` trigger `ensure_message_archived_before_delete_trigger`
   - Trigger calls `x_ensure_message_archived_before_delete()` to verify archiving has been done (skips if already archived)
   - Database deletion proceeds after archiving check

5. **Storage Cleanup Phase**
   - Database `AFTER DELETE` trigger `x_after_delete_message_cleanup_trigger` fires
   - Trigger calls the `x_trigger_storage_cleanup()` function
   - Function invokes the `cleanup-storage-on-delete` edge function
   - Edge function deletes files from storage with retry logic
   - For media groups, all related files are also cleaned up

### Path 2: Frontend-Initiated Deletion (Database Only)

1. **User Initiates Deletion**
   - User clicks delete on a message in the UI
   - User selects "Delete from Database Only"

2. **Database Deletion Phase**
   - `useTelegramOperations.deleteMessage(message, false)` is called
   - Function calls `deleteFromDatabase(messageUuid)` directly
   - Database `BEFORE DELETE` trigger fires to ensure archiving
   - Message is deleted from database

3. **Storage Cleanup Phase**
   - Same as in Path 1

### Path 3: Direct Database Deletion (Safety Net)

1. **Database Deletion Initiated**
   - DELETE query executed directly against `messages` table
   - `BEFORE DELETE` trigger `ensure_message_archived_before_delete_trigger` fires
   - Trigger calls `x_ensure_message_archived_before_delete()` to create archive records
   - Message deletion proceeds

2. **Storage Cleanup Phase**
   - Same as in other paths

## Database Components

### Tables

1. **messages**
   - Main table for all message data
   - Contains fields: `id`, `telegram_message_id`, `chat_id`, `media_group_id`, `file_id`, `storage_path`, etc.

2. **deleted_messages**
   - Archive table for deleted messages
   - Has all the same essential fields as `messages` plus:
     - `original_message_id`: UUID reference to the original message
     - `deleted_at`: Timestamp of deletion
     - `deleted_from_telegram`: Boolean indicating if it was deleted from Telegram
     - `deleted_via_telegram`: Boolean indicating if deletion was initiated from Telegram
     - `deletion_error`: Text field for any errors during deletion

3. **unified_audit_logs**
   - Logging table for all operations
   - Contains fields: `event_type`, `entity_id`, `metadata`, `correlation_id`, `error_message`, etc.
   - Used to track deletion operations across systems

### Functions

1. **x_archive_message_for_deletion(p_message_id UUID)**
   ```sql
   CREATE OR REPLACE FUNCTION x_archive_message_for_deletion(p_message_id UUID)
   RETURNS JSONB AS $$
   DECLARE
     v_message RECORD;
     v_archived_id UUID;
     v_result JSONB;
     v_media_group_messages RECORD;
   BEGIN
     -- Get message details
     SELECT * INTO v_message
     FROM messages
     WHERE id = p_message_id;

     -- Archive the message and return result
     -- [function body details...]
   END;
   $$ LANGUAGE plpgsql;
   ```
   - Archives a message and its media group members in `deleted_messages`
   - Returns JSON with status information

2. **x_trigger_storage_cleanup()**
   ```sql
   CREATE OR REPLACE FUNCTION x_trigger_storage_cleanup()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Call the edge function to clean up storage
     PERFORM
       net.http_post(
         'https://swrfsullhirscyxqneay.supabase.co/functions/v1/cleanup-storage-on-delete',
         jsonb_build_object('message_id', OLD.id),
         headers := '{"Content-Type": "application/json"}'::jsonb
       );

     RETURN OLD;
   END;
   $$ LANGUAGE plpgsql;
   ```
   - Called by the AFTER DELETE trigger
   - Invokes the cleanup-storage-on-delete edge function

3. **x_ensure_message_archived_before_delete()**
   ```sql
   CREATE OR REPLACE FUNCTION x_ensure_message_archived_before_delete()
   RETURNS TRIGGER AS $$
   DECLARE
     v_archived_exists BOOLEAN;
     v_result JSONB;
   BEGIN
     -- Check if already archived
     SELECT EXISTS(
       SELECT 1 FROM deleted_messages
       WHERE original_message_id = OLD.id
     ) INTO v_archived_exists;

     -- Archive if not already done
     IF NOT v_archived_exists THEN
       v_result := x_archive_message_for_deletion(OLD.id);

       -- Log the safety net operation
       -- [logging code...]
     END IF;

     RETURN OLD;
   END;
   $$ LANGUAGE plpgsql;
   ```
   - Safety net function that checks if a message is archived before deletion
   - If not archived, it calls `x_archive_message_for_deletion()`

4. **x_sync_message_caption_edge(p_message_id UUID, p_new_caption text)**
   ```sql
   CREATE OR REPLACE FUNCTION x_sync_message_caption_edge(p_message_id UUID, p_new_caption text)
   RETURNS JSONB AS $$
   DECLARE
     v_result JSONB;
     v_message RECORD;
     v_group_messages JSONB := '[]'::jsonb;
   BEGIN
     -- Get message details and update caption in database
     -- Call edge function to update caption in Telegram
     -- Handle media group caption syncing
     -- Return results with status information
   END;
   $$ LANGUAGE plpgsql;
   ```
   - Updates a message caption in both the database and Telegram
   - Handles media group caption syncing
   - Integrates with the update-telegram-caption edge function

### Triggers

1. **ensure_message_archived_before_delete_trigger**
   ```sql
   CREATE TRIGGER ensure_message_archived_before_delete_trigger
   BEFORE DELETE ON messages
   FOR EACH ROW
   EXECUTE FUNCTION x_ensure_message_archived_before_delete();
   ```
   - Fires BEFORE DELETE on messages
   - Ensures message is archived before deletion

2. **x_after_delete_message_cleanup_trigger**
   ```sql
   CREATE TRIGGER x_after_delete_message_cleanup_trigger
   AFTER DELETE ON messages
   FOR EACH ROW
   EXECUTE FUNCTION x_trigger_storage_cleanup();
   ```
   - Fires AFTER DELETE on messages
   - Calls storage cleanup function

## Edge Functions

### 1. delete-telegram-message

**Location**: `supabase/functions/delete-telegram-message/index.ts`

**Purpose**: Deletes a message from Telegram and handles media group deletion.

**Flow**:
1. Receives message_id, chat_id, and media_group_id parameters
2. Logs the start of the deletion process
3. Deletes the target message from Telegram
4. If it's part of a media group, finds and deletes all related messages
5. Logs the results and returns success/failure

**Key Features**:
- Handles media group deletion
- Comprehensive logging with correlation IDs
- Error handling for Telegram API failures

### 2. cleanup-storage-on-delete

**Location**: `supabase/functions/cleanup-storage-on-delete/index.ts`

**Purpose**: Removes files from storage after message deletion.

**Flow**:
1. Receives message_id parameter
2. If message still exists, gets its storage path
3. If message no longer exists (retry scenario), looks it up in deleted_messages
4. Deletes the file from storage with retry logic
5. For media groups, finds and cleans up all related files
6. Logs results and returns success/failure

**Key Features**:
- Retries failed deletions with exponential backoff
- Handles media group cleanup
- Race condition handling for already-deleted messages
- Comprehensive logging with correlation IDs

### 3. update-telegram-caption

**Location**: `supabase/functions/update-telegram-caption/index.ts`

**Purpose**: Updates a message caption in Telegram.

**Flow**:
1. Receives messageId and newCaption parameters
2. Gets message details from database
3. Updates caption in Telegram via API
4. Updates caption in database
5. If message is part of a media group, updates all related messages
6. Logs results and returns success/failure

**Key Features**:
- Media group handling
- Error handling for Telegram API
- Integration with database caption updates

## Frontend Components

### 1. useTelegramOperations Hook

**Location**: `src/hooks/useTelegramOperations.ts`

**Purpose**: Provides functions for Telegram operations including deletion.

**Key Functions**:
- `deleteMessage(message, deleteFromTelegram)`: Main deletion function
- `deleteTelegramMessage(messageId, chatId, mediaGroupId)`: Calls edge function
- `deleteFromDatabase(messageUuid)`: Deletes from database only

**Deletion Flow Implementation**:
```typescript
const deleteMessage = async (message: Message, deleteFromTelegram = false) => {
  setIsDeleting(true);

  try {
    // Get message properties
    const { id: messageUuid, telegram_message_id: telegramMessageId, chat_id: chatId, media_group_id: mediaGroupId } = message;

    // Database-only deletion
    if (!deleteFromTelegram) {
      const result = await deleteFromDatabase(messageUuid);
      // Handle result...
      return true;
    }

    // Full deletion flow
    // 1. Archive message
    const { error: archiveError } = await supabase.rpc(
      'x_archive_message_for_deletion' as unknown as any,
      { p_message_id: messageUuid }
    );
    // Handle error...

    // 2. Delete from Telegram
    const telegramResult = await deleteTelegramMessage(
      telegramMessageId.toString(),
      chatId.toString(),
      mediaGroupId
    );
    // Handle error...

    // 3. Delete from database
    const dbResult = await deleteFromDatabase(messageUuid);
    // Handle error...

    // Success handling...
    return true;
  } catch (error) {
    // Error handling...
    return false;
  } finally {
    setIsDeleting(false);
  }
};
```

### 2. DeleteMessageDialog Component

**Location**: `src/components/shared/DeleteMessageDialog.tsx`

**Purpose**: UI dialog that confirms deletion and lets user choose deletion type.

**Key Features**:
- Shows warning for media groups
- Offers two deletion options: "Delete from Database Only" and "Delete from Both"
- Passes the user's choice to the parent component

## Row Level Security

Row Level Security (RLS) policies have been standardized for all tables involved in the message deletion system:

### messages Table

```sql
CREATE POLICY "Allow authenticated users full SELECT access" ON public.messages
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users full INSERT access" ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full UPDATE access" ON public.messages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full DELETE access" ON public.messages
    FOR DELETE
    TO authenticated
    USING (true);
```

### deleted_messages Table

```sql
CREATE POLICY "Allow authenticated users full SELECT access" ON public.deleted_messages
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users full INSERT access" ON public.deleted_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full UPDATE access" ON public.deleted_messages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full DELETE access" ON public.deleted_messages
    FOR DELETE
    TO authenticated
    USING (true);
```

### unified_audit_logs Table

```sql
CREATE POLICY "Allow authenticated users full SELECT access" ON public.unified_audit_logs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users full INSERT access" ON public.unified_audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full UPDATE access" ON public.unified_audit_logs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full DELETE access" ON public.unified_audit_logs
    FOR DELETE
    TO authenticated
    USING (true);
```

All tables have RLS enabled with `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY` and are configured to enforce RLS even for the database owner with `ALTER TABLE table_name FORCE ROW LEVEL SECURITY`.

## Troubleshooting

### Common Issues

1. **Message Deleted from Telegram But Not Database**
   - **Cause**: The Telegram deletion succeeded but the database deletion failed
   - **Solution**: Check the `unified_audit_logs` for the correlation ID and error message
   - **Fix**: Run a database deletion manually using the message ID

2. **Storage Not Cleaned Up**
   - **Cause**: The storage cleanup edge function failed or wasn't triggered
   - **Solution**: Check if the message has a `storage_path` and if the trigger is firing
   - **Fix**: The retry job will attempt to clean up failed deletions automatically, or you can call the edge function manually

3. **Media Group Partially Deleted**
   - **Cause**: Some messages in a media group failed to delete
   - **Solution**: Check the `unified_audit_logs` for the specific error on the media group messages
   - **Fix**: Delete the remaining messages manually or check for constraint issues

4. **Missing Archive Records**
   - **Cause**: The archiving function failed or wasn't called
   - **Solution**: Check if the safety net trigger is properly installed
   - **Fix**: Restore from backups if possible, or recreate archive records manually

### Debugging Tips

1. **Use Correlation IDs**
   - Every deletion operation generates a unique correlation ID
   - Search the `unified_audit_logs` for this ID to trace the full operation

2. **Check Trigger Installation**
   - Verify that both triggers are properly installed on the messages table:
     ```sql
     SELECT tgname, tgrelid::regclass, tgenabled
     FROM pg_trigger
     WHERE tgrelid = 'messages'::regclass;
     ```

3. **Check RLS Policies**
   - Verify that RLS policies are properly configured:
     ```sql
     SELECT tablename, policyname, permissive, roles, cmd, qual
     FROM pg_policies
     WHERE tablename IN ('messages', 'deleted_messages', 'unified_audit_logs');
     ```

4. **Test Edge Functions Directly**
   - You can test the edge functions directly by calling them with a message ID:
     ```
     DELETE FROM messages WHERE id = 'your_message_id';
     ```
     Then check logs for any errors

## Testing

To verify the deletion system is working correctly, you can run these tests:

### Test 1: Full Deletion Flow

1. Create a new test message
2. Record its `id` and `storage_path`
3. Delete it via the UI using "Delete from Both" option
4. Verify:
   - No record in `messages` table
   - Record exists in `deleted_messages` table
   - File no longer exists in storage
   - Message no longer visible in Telegram

### Test 2: Safety Net Trigger

1. Create a new test message
2. Record its `id`
3. Delete directly from database without archiving:
   ```sql
   DELETE FROM messages WHERE id = 'your_message_id';
   ```
4. Verify:
   - Record exists in `deleted_messages` table (created by safety net)
   - Entry in `unified_audit_logs` with event_type 'message_safety_net_archive'

### Test 3: Media Group Deletion

1. Create a test message that's part of a media group
2. Record the `media_group_id`
3. Delete via the UI using "Delete from Both" option
4. Verify:
   - All messages with that `media_group_id` are deleted from `messages`
   - All related messages exist in `deleted_messages`
   - All related files are removed from storage
   - All messages are removed from Telegram

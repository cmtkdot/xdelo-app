# Telegram Webhook & Media Group Sync Logic

## Overview: Logic in Natural Language

This project processes Telegram messages (media and text) using edge functions, shared utilities, and Supabase database triggers/functions. The main goals are:
- To store and analyze incoming Telegram messages (including media groups).
- To ensure that when a message's caption is edited, the latest caption and analysis are propagated to all messages in the same media group.
- To maintain a clear source-of-truth for each media group, using the `message_caption_id` column.
- To handle duplicate messages and avoid reprocessing.
- To provide a robust message deletion flow with archiving, storage cleanup, and media group handling.

### Key Concepts
- **Edge Functions**: Handle incoming Telegram webhook events, parse and process messages, update the database, delete messages, and clean up storage.
- **Shared Utilities**: Provide reusable logic for parsing captions, handling retries, and interacting with Supabase.
- **Supabase Database Functions/Triggers**: Enforce data consistency, propagate edits across media groups, extract structured data from captions, and ensure proper archiving before deletion.

---

## Chronological Flow: How a Telegram Message is Processed (Expanded)

1. **Telegram Webhook Event Received**
   - `index.ts` receives the HTTP request from Telegram.
   - Parses and validates the request, extracting the message object.

2. **Message Routing**
   - Determines the message type (edit, media, text, etc.).
   - Dispatches to the appropriate handler:
     - `handleEditedMessage` for edits.
     - `handleMediaMessage` for new media.
     - `handleOtherMessage` for text.

3. **Handler Processing**
   - Each handler:
     - Checks for duplicate messages to avoid reprocessing.
     - Parses captions using `_shared/captionParser.ts`.
     - Upserts or updates the message in the database (using `upsert_media_message` or similar).
     - For edits, updates `caption`, `analyzed_content`, and triggers sync by setting `processing_state = 'initialized'`.

4. **Database Triggers & Functions**
   - **BEFORE triggers** extract structured data from `analyzed_content` into dedicated columns.
   - **AFTER triggers** call the sync logic (`x_sync_media_group_captions`) to propagate the latest caption/analysis to all group members and update `message_caption_id` relationships.

5. **Data Consistency**
   - After all triggers/functions run, all messages in a media group have the latest caption/analysis.
   - Only the source message has `message_caption_id IS NULL`; all others point to it.

6. **Logging & Error Handling**
   - All steps are logged with correlation IDs for traceability.
   - Errors are handled gracefully, with retries and clear error responses.

---

## Message Deletion Flow: How Messages Are Deleted and Archived

1. **Deletion Initiated**
   - Frontend uses `useTelegramOperations.deleteMessage()` which has two paths:
     - Database-only deletion: Just removes from the database
     - Full deletion: Archives, deletes from Telegram, then deletes from database

2. **Archiving Process**
   - Before deletion, messages are archived using `x_archive_message_for_deletion` RPC function
   - Archives the message and all related media group messages to `deleted_messages` table
   - Preserves all critical data: caption, media info, analyzed content, and telegram metadata

3. **Telegram Deletion**
   - `delete-telegram-message` edge function handles Telegram API communication
   - Deletes the message from Telegram
   - For media groups, deletes all related messages from Telegram
   - Logs all operations with correlation IDs for traceability

4. **Database Deletion**
   - After successful Telegram deletion, the message is removed from the database
   - Safety net trigger `ensure_message_archived_before_delete_trigger` (BEFORE DELETE) ensures archiving
   - ON DELETE CASCADE constraints ensure related records are properly cleaned up

5. **Storage Cleanup**
   - After database deletion, `x_after_delete_message_cleanup_trigger` (AFTER DELETE) fires
   - Triggers the `cleanup-storage-on-delete` edge function
   - Function removes files from storage with retry logic and exponential backoff
   - Also handles cleanup of all related media group files

6. **Error Handling & Recovery**
   - All operations use correlation IDs to track across frontend, database, and edge functions
   - Failed storage deletions are automatically retried via scheduled job
   - Comprehensive logging in `unified_audit_logs` table
   - Edge functions handle partial failures gracefully (e.g., Telegram deletion succeeds but DB fails)

---

## Key Supabase Database Functions and Triggers

- **Functions:**
  - `upsert_media_message`: Upserts a media message record.
  - `x_extract_analyzed_content_to_columns`: Extracts fields from `analyzed_content` JSON into columns.
  - `x_sync_media_group_captions`: Propagates the latest caption/analysis to all group members and manages `message_caption_id`.
  - `x_handle_media_group_sync_trigger`: Calls the sync function after relevant changes.
  - `x_archive_message_for_deletion`: Archives messages and their media groups before deletion.
  - `x_trigger_storage_cleanup`: Calls the cleanup edge function after message deletion.
  - `ensure_message_archived_before_delete`: Safety net to ensure messages are archived before deletion.
  - `retry_failed_storage_cleanup`: Scheduled function to retry failed storage cleanup operations.

- **Triggers:**
  - `x_trigger_extract_analyzed_content` (BEFORE INSERT/UPDATE on messages)
  - `x_trigger_sync_media_group` (AFTER INSERT/UPDATE on messages)
  - `x_trigger_generate_standardized_media_urls` (BEFORE INSERT/UPDATE on messages)
  - `ensure_message_archived_before_delete_trigger` (BEFORE DELETE on messages)
  - `x_after_delete_message_cleanup_trigger` (AFTER DELETE on messages)

---

## File/Module Relationships

- **Edge Functions:**
  - `supabase/functions/telegram-webhook/index.ts`: Entrypoint for webhook events.
  - `handlers/`: Contains logic for new, edited, and text messages.
  - `supabase/functions/delete-telegram-message/index.ts`: Handles message deletion from Telegram.
  - `supabase/functions/cleanup-storage-on-delete/index.ts`: Handles storage cleanup after deletion.
  - `supabase/functions/update-telegram-caption/index.ts`: Handles caption updates in Telegram and database.

- **Frontend Components:**
  - `src/hooks/useTelegramOperations.ts`: Manages message operations including deletion.
  - `src/components/MessagesTable/TableComponents/DeleteConfirmationDialog.tsx`: UI for deletion confirmation.

- **Shared Utilities:**
  - `_shared/captionParser.ts`: Parses captions into structured data.
  - `_shared/supabaseClient.ts`: Supabase client instance for DB operations.
  - `_shared/retryHandler.ts`, `_shared/mediaUtils.ts`, etc.: Utility logic.

- **Database Functions/Triggers:**
  - Defined in SQL migrations or via the Supabase dashboard, and referenced by name in the logic above.

---

## Summary

This architecture ensures that:
- All edits to captions in media groups are consistently and automatically propagated to all group members.
- The latest edit is always the source of truth, and the database enforces this via triggers and functions.
- Edge functions focus on parsing, validation, and upserting, while the database handles propagation and consistency.
- Messages are archived before deletion, ensuring data is preserved for audit and recovery purposes.
- Storage cleanup is reliable with automatic retry mechanisms for failed operations.
- Media groups are handled consistently across all operations (editing, deletion, storage cleanup).

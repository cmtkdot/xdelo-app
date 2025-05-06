# Telegram Webhook & Media Group Sync Logic

## Overview: Logic in Natural Language

This project processes Telegram messages (media and text) using edge functions, shared utilities, and Supabase database triggers/functions. The main goals are:
- To store and analyze incoming Telegram messages (including media groups).
- To ensure that when a message's caption is edited, the latest caption and analysis are propagated to all messages in the same media group.
- To maintain a clear source-of-truth for each media group, using the `message_caption_id` column.
- To handle duplicate messages and avoid reprocessing.

### Key Concepts
- **Edge Functions**: Handle incoming Telegram webhook events, parse and process messages, and update the database.
- **Shared Utilities**: Provide reusable logic for parsing captions, handling retries, and interacting with Supabase.
- **Supabase Database Functions/Triggers**: Enforce data consistency, propagate edits across media groups, and extract structured data from captions.

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

### Key Points
- The **entrypoint (`index.ts`)** is the orchestrator: it routes, logs, and applies retry logic, but delegates all business logic to handlers and the database.
- **Handlers** are responsible for parsing, validation, and upserting/updating messages.
- **Shared utilities** (in `_shared/`) provide parsing, Supabase client, and retry logic.
- **Database triggers/functions** enforce data consistency, propagate edits, and manage group relationships.

---

## Key Supabase Database Functions and Triggers

- **Functions:**
  - `upsert_media_message`: Upserts a media message record.
  - `x_extract_analyzed_content_to_columns`: Extracts fields from `analyzed_content` JSON into columns.
  - `x_sync_media_group_captions`: Propagates the latest caption/analysis to all group members and manages `message_caption_id`.
  - `x_handle_media_group_sync_trigger`: Calls the sync function after relevant changes.
- **Triggers:**
  - `x_trigger_extract_analyzed_content` (BEFORE INSERT/UPDATE on messages)
  - `x_trigger_sync_media_group` (AFTER INSERT/UPDATE on messages)
  - `x_trigger_generate_standardized_media_urls` (BEFORE INSERT/UPDATE on messages)
  - `x_after_delete_message_cleanup` (AFTER DELETE on messages)

---

## File/Module Relationships

- **Edge Functions:**
  - `supabase/functions/telegram-webhook/index.ts`: Entrypoint for webhook events.
  - `handlers/`: Contains logic for new, edited, and text messages.
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

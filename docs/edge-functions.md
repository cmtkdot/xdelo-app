
# Supabase Edge Functions Documentation

This document provides an overview of all active edge functions in the project, their purposes, dependencies, and relationships.

## Core Functions

### telegram-webhook
**Purpose**: Primary entry point for all Telegram bot interactions
**Dependencies**:
- `_shared/cors.ts`
- `telegram-webhook/handlers/` (various handlers)
- `telegram-webhook/utils/mediaUtils.ts`

### parse-caption-with-ai
**Purpose**: Analyzes message captions with AI to extract product information
**Dependencies**:
- OpenAI API
- `_shared/captionParser.ts`
- `parse-caption-with-ai/dbOperations.ts`

### manual-caption-parser
**Purpose**: Processes message captions without AI using pattern matching
**Dependencies**:
- `_shared/captionParser.ts`
- `xdelo_sync_media_group` (for propagating changes to media groups)

### xdelo_reprocess_message
**Purpose**: Reprocesses messages that failed initial processing
**Dependencies**:
- `manual-caption-parser` or `parse-caption-with-ai` (based on configuration)
- `_shared/databaseOperations.ts`

### xdelo_sync_media_group
**Purpose**: Synchronizes captions and analysis across media group members
**Dependencies**:
- `_shared/supabase.ts`
- Database tables: `messages`

## Media Management Functions

### redownload-missing-files
**Purpose**: Attempts to recover media files from Telegram
**Dependencies**:
- Telegram Bot API
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### xdelo_file_repair
**Purpose**: Repairs file storage issues like invalid content-type
**Dependencies**:
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### xdelo_fix_content_disposition
**Purpose**: Fixes content disposition headers for media files
**Dependencies**:
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### xdelo_standardize_storage_paths
**Purpose**: Ensures consistent storage paths for media files
**Dependencies**:
- `_shared/supabase.ts`
- Database tables: `messages`
- Storage bucket: `telegram-media`

### xdelo_standardize_urls
**Purpose**: Standardizes public URLs for media files
**Dependencies**:
- `_shared/standardHandler.ts`
- Database function: `xdelo_fix_public_urls`

### xdelo_fix_media_urls
**Purpose**: Legacy function to repair broken media URLs
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `messages`

### cleanup-storage-on-delete
**Purpose**: Removes storage files when messages are deleted
**Dependencies**:
- `_shared/cors.ts`
- Storage bucket: `telegram-media`
- Database triggers: `on_message_deleted`

### media-management
**Purpose**: Provides API for frontend media operations
**Dependencies**:
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### validate-storage-files
**Purpose**: Verifies storage file integrity and existence
**Dependencies**:
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`
- Database tables: `messages`

## Message Processing Functions

### create-analyze-message-caption
**Purpose**: Creates analysis tasks for message captions
**Dependencies**:
- `parse-caption-with-ai`
- Database function: `xdelo_analyze_message_caption`

### analyze-with-ai
**Purpose**: General-purpose AI analysis for various content
**Dependencies**:
- OpenAI API
- `_shared/cors.ts`

### xdelo_process_captions
**Purpose**: Triggered by database to process new captions
**Dependencies**:
- Database function: `xdelo_process_caption_workflow`
- Database triggers: on message insert/update

### product-matching
**Purpose**: Matches message products with GL product database
**Dependencies**:
- `product-matching/matching-utils.ts`
- Database tables: `gl_products`, `messages`

### process-audio-upload
**Purpose**: Handles audio file uploads and transcription
**Dependencies**:
- `_shared/cors.ts`
- Storage bucket: `audio-uploads`
- OpenAI API (for transcription)

## Telegram Management Functions

### delete-telegram-message
**Purpose**: Deletes messages from Telegram and database
**Dependencies**:
- Telegram Bot API
- `_shared/cors.ts`
- Database tables: `messages`, `unified_audit_logs`

### update-telegram-caption
**Purpose**: Updates message captions in Telegram
**Dependencies**:
- Telegram Bot API
- `_shared/cors.ts`
- Database tables: `messages`

## Utility Functions

### xdelo_clear_all_messages
**Purpose**: Administrative function to clear all messages
**Dependencies**:
- `_shared/supabase.ts`
- Database function: `xdelo_clear_all_messages`

### xdelo_execute_sql
**Purpose**: Runs SQL queries via edge function
**Dependencies**:
- `_shared/cors.ts`
- `_shared/errorHandler.ts`
- Database function: `xdelo_execute_sql_query`

### log-operation
**Purpose**: Logs frontend operations to audit system
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `unified_audit_logs`

### user-data
**Purpose**: Retrieves user-specific data
**Dependencies**:
- `_shared/cors.ts`
- `_shared/jwt-verification.ts`
- `_shared/errorHandler.ts`

### generic-webhook
**Purpose**: General webhook endpoint for external integrations
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `webhook_logs`

### create-ayd-session
**Purpose**: Creates "Ask Your Database" sessions
**Dependencies**:
- AYD API
- Environment variables: `AYD_API_KEY`, `AYD_CHATBOT_ID`

### openai-request
**Purpose**: Proxy for OpenAI API requests
**Dependencies**:
- OpenAI API
- `_shared/cors.ts`

## Database Maintenance Functions

### xdelo_cleanup_db_functions
**Purpose**: Cleans up deprecated database functions
**Dependencies**:
- `_shared/cors.ts`
- Database function: `xdelo_execute_sql_query`

## Shared Libraries

### _shared/supabase.ts
**Purpose**: Standardized Supabase client for edge functions
**Used by**: Most edge functions

### _shared/cors.ts
**Purpose**: Cross-Origin Resource Sharing headers
**Used by**: All publicly accessible edge functions

### _shared/captionParser.ts
**Purpose**: Shared logic for parsing message captions
**Used by**: `manual-caption-parser`, `parse-caption-with-ai`

### _shared/mediaUtils.ts
**Purpose**: Utilities for media file operations
**Used by**: Media management functions, `telegram-webhook`

### _shared/databaseOperations.ts
**Purpose**: Common database operations
**Used by**: Message processing functions

### _shared/standardHandler.ts
**Purpose**: Standardized request handler with error handling
**Used by**: Several edge functions

### _shared/errorHandler.ts
**Purpose**: Error handling utilities
**Used by**: Several edge functions

### _shared/jwt-verification.ts
**Purpose**: JWT token verification for authenticated endpoints
**Used by**: Protected edge functions

## Migration Strategy

When considering updates to edge functions:

1. **Documentation First**: Update this document when adding/modifying functions
2. **Deprecation Path**: Mark functions as deprecated before removal
3. **Dependency Mapping**: Check cross-function dependencies before changes
4. **Backward Compatibility**: Maintain compatibility with existing frontend code
5. **Gradual Transition**: Phase out deprecated functions over time

## Function Organization

Functions follow these naming conventions:

- `xdelo_*` prefix: Database-integrated functions with triggers/hooks
- Kebab-case names: Standard HTTP endpoint functions
- No prefix: Legacy functions (maintain for compatibility)

## Error Handling

Most functions implement standardized error handling with:
- Correlation ID tracking
- Error logging to `unified_audit_logs`
- Consistent error response format
- CORS headers on all responses

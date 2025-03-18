
# Supabase Edge Functions Documentation

This document provides an overview of all active edge functions in the project, their purposes, dependencies, and relationships. Recently, we removed legacy `xdelo_` prefixed functions and standardized the naming conventions.

## Core Functions

### telegram-webhook
**Purpose**: Primary entry point for all Telegram bot interactions
**Dependencies**:
- `_shared/cors.ts`
- `telegram-webhook/handlers/` (various handlers)
- `_shared/mediaUtils.ts`

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
- `sync_media_group` (for propagating changes to media groups)

### reprocess_message
**Purpose**: Reprocesses messages that failed initial processing
**Dependencies**:
- `manual-caption-parser` or `parse-caption-with-ai` (based on configuration)
- `_shared/databaseOperations.ts`

### sync_media_group
**Purpose**: Synchronizes captions and analysis across media group members
**Dependencies**:
- `_shared/supabase.ts`
- Database tables: `messages`

## Media Management Functions

### unified_media_repair
**Purpose**: Comprehensive media file repair and validation utility
**Dependencies**:
- `_shared/mediaUtils.ts`
- Telegram Bot API
- Storage bucket: `telegram-media`
- Database tables: `messages`

### redownload-missing-files
**Purpose**: Attempts to recover media files from Telegram
**Dependencies**:
- Telegram Bot API
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### file_repair
**Purpose**: Repairs file storage issues like invalid content-type
**Dependencies**:
- `_shared/mediaUtils.ts`
- Storage bucket: `telegram-media`

### standardize_storage_paths
**Purpose**: Ensures consistent storage paths for media files
**Dependencies**:
- `_shared/supabase.ts`
- Database tables: `messages`
- Storage bucket: `telegram-media`

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
- Database function: `analyze_message_caption`

### analyze-with-ai
**Purpose**: General-purpose AI analysis for various content
**Dependencies**:
- OpenAI API
- `_shared/cors.ts`

### process_captions
**Purpose**: Triggered by database to process new captions
**Dependencies**:
- Database function: `process_caption_workflow`
- Database triggers: on message insert/update

### product-matching
**Purpose**: Matches message products with GL product database
**Dependencies**:
- `product-matching/matching-utils.ts`
- Database tables: `gl_products`, `messages`

## Utility Functions

### clear_all_messages
**Purpose**: Administrative function to clear all messages
**Dependencies**:
- `_shared/supabase.ts`
- Database function: `clear_all_messages`

### log-operation
**Purpose**: Logs frontend operations to audit system
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `unified_audit_logs`

### cleanup_legacy_functions
**Purpose**: Removes deprecated legacy functions
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `unified_audit_logs`

### execute_sql_migration
**Purpose**: Executes SQL migrations for system maintenance
**Dependencies**:
- `_shared/cors.ts`
- Database function: `execute_sql_query`

### migrate_db_functions
**Purpose**: Analyzes and migrates database functions
**Dependencies**:
- `_shared/cors.ts`
- Database tables: `unified_audit_logs`

## Shared Libraries

### _shared/mediaUtils.ts
**Purpose**: Centralized utilities for media file operations
**Used by**: All media handling functions, `telegram-webhook`
**Key Features**:
- Media download with retry logic
- File type detection and validation
- Storage path standardization
- Content disposition management
- Rate limiting for Telegram API

### _shared/supabase.ts
**Purpose**: Standardized Supabase client for edge functions
**Used by**: Most edge functions

### _shared/cors.ts
**Purpose**: Cross-Origin Resource Sharing headers
**Used by**: All publicly accessible edge functions

### _shared/captionParser.ts
**Purpose**: Shared logic for parsing message captions
**Used by**: `manual-caption-parser`, `parse-caption-with-ai`

## Migration Strategy

When considering updates to edge functions:

1. **Documentation First**: Update this document when adding/modifying functions
2. **Deprecation Path**: Mark functions as deprecated before removal
3. **Dependency Mapping**: Check cross-function dependencies before changes
4. **Backward Compatibility**: Maintain compatibility with existing frontend code
5. **Gradual Transition**: Phase out deprecated functions over time

## Function Organization

Functions follow these naming conventions:

- Kebab-case names: Standard HTTP endpoint functions (e.g., `analyze-with-ai`)
- Snake_case names: Database-integrated functions (e.g., `process_captions`)
- No prefix: All functions use consistent naming without prefixes

## Error Handling

Functions implement standardized error handling with:
- Correlation ID tracking
- Error logging to `unified_audit_logs`
- Consistent error response format
- CORS headers on all responses

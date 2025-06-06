# Supabase Edge Functions Documentation

This document provides a comprehensive overview of all active edge functions in the project, their purposes, dependencies, and technical implementation details.

## Core Functions

### `telegram-webhook`

**Purpose**: Primary entry point for all Telegram bot interactions. Handles incoming webhook requests from Telegram's API and routes them to appropriate handlers based on message type.

**Key Features**:
- Processes both new and edited messages
- Routes media messages to `mediaMessageHandler`
- Routes text messages to `textMessageHandler`
- Maintains correlation tracking for full traceability
- Implements CORS and error handling

**Dependencies**:
- `_shared/cors.ts`
- `telegram-webhook/handlers/mediaMessageHandler.ts`
- `telegram-webhook/handlers/textMessageHandler.ts`
- `telegram-webhook/handlers/editedMessageHandler.ts`
- `_shared/MediaProcessor.ts`
- `_shared/consolidatedMessageUtils.ts`

**Security**:
- Validates Telegram bot token
- Ensures request integrity

### `update-telegram-caption`

**Purpose**: Allows programmatic updating of captions for existing media messages on Telegram.

**Key Features**:
- Updates caption text on Telegram's servers
- Synchronizes caption changes to the database
- Maintains content analysis history
- Handles media group synchronization

**Dependencies**:
- Telegram Bot API
- Supabase client
- Database tables: `messages`

**Technical Details**:
- Preserves previous caption analysis in `old_analyzed_content`
- Resets processing state to trigger reanalysis
- Synchronizes changes across media groups

### `delete-telegram-message`

**Purpose**: Provides an API endpoint to delete messages from both Telegram and the local database.

**Key Features**:
- Handles both single message and media group deletion
- Removes messages from Telegram chat
- Cleans up associated database records
- Provides comprehensive audit logging

**Dependencies**:
- `_shared/cors.ts`
- Telegram Bot API
- Database tables: `messages`, `unified_audit_logs`

**Technical Details**:
- Implements specialized handling for media groups
- Cascades deletion to related records
- Maintains audit trail of deletion operations

### `create-ayd-session`

**Purpose**: Creates a new AYD (Are You Delivering) session for delivery tracking.

**Key Features**:
- Generates unique session identifiers
- Initializes delivery tracking state
- Associates session with relevant conversations

**Dependencies**:
- Supabase client
- Database tables: `ayd_sessions`, `chats`

### `manual-caption-parser`

**Purpose**: Provides an endpoint for manually parsing caption text outside the normal message flow.

**Key Features**:
- Processes caption text with the same logic as the webhook
- Updates existing message records with new analysis
- Allows retroactive parsing of captions

**Dependencies**:
- Parsing utilities
- Database tables: `messages`

### `media_group_sync_cron`

**Purpose**: Scheduled function to ensure media groups remain synchronized.

**Key Features**:
- Identifies media groups with inconsistent data
- Synchronizes captions and analysis across groups
- Repairs inconsistencies in processing state

**Dependencies**:
- Database tables: `messages`

**Technical Details**:
- Runs on a scheduled basis
- Uses database locking to prevent race conditions
- Logs synchronization actions for auditing

### `product-matching`

**Purpose**: Matches media messages with product catalog entries based on caption content.

**Key Features**:
- Analyzes caption data for product references
- Matches with product catalog using fuzzy logic
- Updates message records with matched product information

**Dependencies**:
- Database tables: `messages`, `products`
- Text analysis utilities

### `cleanup-storage-on-delete`

**Purpose**: Cleans up storage objects when associated media messages are deleted.

**Key Features**:
- Triggered by message deletion operations
- Removes files from Supabase storage
- Ensures no orphaned storage objects remain

**Dependencies**:
- Supabase storage client
- Database triggers

## Shared Components

### `_shared/MediaProcessor.ts`

**Purpose**: Core utility class for processing all types of media from Telegram.

**Key Features**:
- MIME type detection and validation
- File path generation and standardization
- Media download and upload handling
- Metadata extraction from media files

**Used By**:
- `telegram-webhook`
- Various media processing functions

### `_shared/cors.ts`

**Purpose**: Provides standardized CORS handling for all edge functions.

**Key Features**:
- Defines appropriate CORS headers
- Handles preflight requests
- Creates a standardized Supabase client

**Used By**:
- All edge functions that expose HTTP endpoints

### `_shared/consolidatedMessageUtils.ts`

**Purpose**: Shared utilities for message processing across functions.

**Key Features**:
- Message structure validation
- Forward detection
- Message type classification
- Data extraction helpers

**Used By**:
- `telegram-webhook`
- `update-telegram-caption`
- Other message-handling functions

## Handlers

### `telegram-webhook/handlers/mediaMessageHandler.ts`

**Purpose**: Specialized handler for processing media messages (photos, videos, documents, etc.).

**Key Features**:
- Handles media downloads from Telegram
- Processes different media types appropriately
- Manages caption parsing and analysis
- Handles duplicate media with different captions
- Synchronizes caption changes across media groups

**Technical Details**:
- Preserves content analysis history
- Manages processing states throughout the flow
- Implements specialized handling for each media type

### `telegram-webhook/handlers/textMessageHandler.ts`

**Purpose**: Processes text messages and commands received through Telegram.

**Key Features**:
- Parses text content and entities
- Handles command recognition
- Processes structured text data
- Supports both new and edited text messages

### `telegram-webhook/handlers/editedMessageHandler.ts`

**Purpose**: Specialized handler for processing edited messages.

**Key Features**:
- Detects changes in edited messages
- Routes to appropriate specialized handlers
- Maintains edit history
- Ensures consistent processing of changes

## Technical Implementation

### Environment Variables

The edge functions rely on the following environment variables:

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Authentication for Telegram Bot API |
| `SUPABASE_URL` | URL of the Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access key for Supabase |
| `SUPABASE_ANON_KEY` | Public access key for Supabase |

### Error Handling

All edge functions implement a standardized error handling approach:

1. Catch all errors in a centralized try-catch block
2. Log errors with correlation IDs
3. Return standardized error responses with appropriate HTTP status codes
4. Maintain CORS headers even in error responses

### Logging

Edge functions use a comprehensive logging approach:

1. All significant operations are logged with correlation IDs
2. Logs include timestamps, operation types, and outcomes
3. Long-running operations include start and completion logs
4. Errors include detailed context information

### Deployment

Edge functions are deployed through the Supabase CLI using:

```bash
supabase functions deploy <function-name> --project-ref <project-id>
```

Functions require appropriate environment variables to be set in the Supabase dashboard.

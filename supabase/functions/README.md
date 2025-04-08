# Supabase Edge Functions

This directory contains Edge Functions for the Xdelo application. The functions have been consolidated and streamlined for better maintainability and performance.

## Consolidated Functions

### Base Utilities
- **_shared/baseUtils.ts**: Consolidated utilities for all functions (merged from utils.ts and consolidatedMessageUtils.ts)
- This provides a single source of truth for shared functionality like logging, response formatting, and Supabase client initialization

### Consolidated Functions
1. **message-processor**: Unified function for all message processing operations
   - Combines functionality from manual-caption-parser and parse-caption-with-ai
   - Supports multiple action types via a single endpoint
   - Improved error handling and logging
   
2. **media-processor**: Unified function for all media file operations
   - Combines functionality from media-management, validate-storage-files, and repair-media
   - Action-based API for different operations
   - Comprehensive logging for all operations

## Legacy Functions (To be deprecated)
The following functions have been consolidated and will be phased out:
- manual-caption-parser
- parse-caption-with-ai
- sync-media-group (functionality moved to message-processor)
- media-management 
- validate-storage-files
- repair-media

## Usage Examples

### message-processor
```json
// Parse caption manually
{
  "action": "parse_caption",
  "messageId": "uuid",
  "correlationId": "optional-id",
  "syncMediaGroup": true
}

// Analyze with AI
{
  "action": "analyze_with_ai",
  "messageId": "uuid",
  "options": {
    "aiModel": "gpt-4",
    "temperature": 0.7
  }
}

// Process media group only
{
  "action": "process_media_group",
  "messageId": "uuid",
  "forceSync": true
}
```

### media-processor
```json
// Fix content disposition
{
  "action": "fix_content_disposition", 
  "messageIds": ["uuid1", "uuid2"]
}

// Repair file metadata
{
  "action": "repair_metadata", 
  "messageId": "uuid1"
}

// Validate media files
{
  "action": "validate_files", 
  "messageIds": ["uuid1", "uuid2"]
}

// Fix missing MIME types
{
  "action": "fix_mime_types"
}

// Standardize storage paths
{
  "action": "standardize_storage_paths",
  "options": {
    "dryRun": false,
    "skipExisting": true,
    "batchSize": 50
  }
}
```

## Migration Plan

1. Deploy new consolidated functions alongside existing ones
2. Update frontend code to use new endpoints
3. Monitor usage and logs to ensure all functionality works correctly
4. Gradually deprecate old endpoints with warning messages
5. Remove deprecated functions once all usage has migrated

## Next Steps for Consolidation

1. Create a unified **ai-service** function that combines:
   - openai-request
   - analyze-with-ai

2. Create a unified **product-service** function that consolidates:
   - product-matching

3. Review and update the telegram-webhook function to use consolidated utilities

## Monitoring and Maintenance

The consolidated functions include improved logging with consistent event types and structures:
- All actions log start/completion/error events
- All logs include correlationId for request tracing
- Error details are consistently captured and reported

This enables better monitoring and troubleshooting of the application.

## Logging Reference

### Event Types
- `message_processing_started`
- `message_processing_completed`
- `message_processing_error`
- `ai_analysis_started`
- `ai_analysis_completed`
- `ai_analysis_error`
- Various media operation events (fix_content_disposition_*, validate_media_*, etc.)

Each event includes:
- correlationId
- entityId (usually the message ID)
- timestamp
- operation-specific metadata
- error information (for error events) 
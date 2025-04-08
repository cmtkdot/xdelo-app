# Edge Functions Consolidation Plan

## Current State
The project currently contains multiple edge functions with overlapping functionality:

- **telegram-webhook**: Main webhook handler for Telegram messages
- **manual-caption-parser**: Handles manual caption parsing
- **parse-caption-with-ai**: AI-based caption parsing
- **sync-media-group**: Synchronizes captions across media groups
- **log-operation**: Simple logging endpoint
- **media-management**: Various media file operations
- **validate-storage-files**: Storage validation
- **update-telegram-caption**: Updates captions
- **repair-media**: Media repair functions
- **product-matching**: Product matching logic
- **openai-request**: OpenAI API integration
- **analyze-with-ai**: AI analysis endpoint

There's significant duplication in utility functions and similar operations spread across multiple functions.

## Issues Identified

1. Redundant code across functions
2. Inconsistent logging approaches
3. Multiple utility files with overlapping functions
4. Different error handling approaches
5. Inconsistent usage of shared components
6. Some functions using old/deprecated calls

## Consolidation Strategy

### Phase 1: Shared Utilities Cleanup

1. **Consolidate shared utilities**
   - Merge `utils.ts` and `consolidatedMessageUtils.ts` into a single utility file
   - Ensure all functions use the shared utilities properly
   - Update the logging functions to consistently use `xdelo_log_event`

2. **Standardize types**
   - Create a single comprehensive types file
   - Remove duplicated type declarations

### Phase 2: Core Function Consolidation

1. **Create unified message processing function**
   - Combine `manual-caption-parser` and `parse-caption-with-ai` into a single `caption-processor` function
   - Use a mode parameter to switch between manual and AI processing

2. **Create unified media management function**
   - Combine `media-management`, `validate-storage-files`, and `repair-media` into a single `media-processor` function
   - Use action parameters to determine the specific operation

3. **Simplify AI operations**
   - Merge `openai-request` and `analyze-with-ai` into a unified `ai-service` function
   - Create a standardized API for all AI operations

### Phase 3: Implementation Plan

1. **Update _shared directory**
   ```
   _shared/
     - baseUtils.ts       # Core utility functions
     - messageUtils.ts    # Message-specific utilities 
     - mediaUtils.ts      # Media processing utilities
     - aiUtils.ts         # AI processing utilities
     - types.ts           # Consolidated types
     - supabase.ts        # Supabase client
     - standardHandler.ts # Standard request handler
     - errorHandler.ts    # Error handling utilities
   ```

2. **Consolidated Functions**
   ```
   functions/
     - telegram-webhook/   # Main webhook (keep separate due to complexity)
     - message-processor/  # Combined caption parsing functionality
     - media-processor/    # Unified media operations
     - ai-service/         # Consolidated AI operations
     - product-service/    # Product-related functionality
   ```

### Phase 4: Migration Strategy

1. For each consolidation:
   - Create the new function first
   - Test thoroughly with equivalent requests
   - Update frontend to use the new endpoints
   - Keep old endpoints temporarily with deprecation notices
   - Remove old functions after migration is complete

## Implementation Details

### telegram-webhook
- **Keep separate** due to complexity and specific purpose
- Update to use consolidated shared utilities
- Standardize error handling and logging

### message-processor (consolidate manual-caption-parser and parse-caption-with-ai)
```typescript
// Request format
{
  "action": "parse_caption",     // or "analyze_with_ai"
  "messageId": "uuid",
  "correlationId": "optional-id",
  "syncMediaGroup": true,        // optional
  "options": {                   // mode-specific options
    "aiModel": "gpt-4",          // for AI analysis
    "temperature": 0.7           // for AI analysis
  }
}
```

### media-processor (consolidate media-management, validate-storage-files, repair-media)
```typescript
// Request format
{
  "action": "fix_content_disposition", // or validate_files, repair_metadata, etc.
  "messageId": "uuid",                 // single ID
  "messageIds": ["uuid1", "uuid2"],    // or batch
  "options": {                         // action-specific options
    "deleteOrphaned": false,
    "fixMissingMimeTypes": true
  }
}
```

### ai-service (consolidate openai-request and analyze-with-ai)
```typescript
// Request format
{
  "action": "analyze_text",      // or generate_text, extract_entities, etc.
  "content": "text to analyze",
  "messageId": "optional-uuid",  // reference to message
  "model": "gpt-4",
  "options": {                   // model-specific options
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

## Success Criteria

1. Reduced codebase size with fewer redundant files
2. Consistent error handling and logging across all functions
3. Improved maintainability with standardized interfaces
4. No disruption to existing functionality during migration
5. Complete test coverage for consolidated functions 
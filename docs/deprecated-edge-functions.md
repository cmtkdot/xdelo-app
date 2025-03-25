# Deprecated Edge Functions

This document lists edge functions that are being deprecated as part of the caption processing cleanup.

## Status Update (March 2024)

The following edge functions have been removed as part of the caption processing cleanup:

1. ~~`manual-caption-parser` - Replaced by direct database functions~~ (Still active but scheduled for replacement)
2. `xdelo_caption_parser` - Replaced by direct database functions
3. `analyze-with-ai` - Replaced by direct database functions
4. `parse-caption-with-ai` - Replaced by direct database functions

The config.toml file has been updated to remove references to these functions, and frontend code has been modified to use direct database RPC calls.

## Migration Details

All functionality from these edge functions has been migrated to database functions:

- `xdelo_parse_caption` - SQL implementation of the caption parsing logic
- `xdelo_direct_caption_processing` - Direct database caption processor
- `xdelo_process_caption_workflow` - Main workflow orchestrator

## Overview

As part of the system cleanup and modernization, several edge functions have been deprecated in favor of:
1. Direct database processing using PostgreSQL functions
2. Simplified message processing architecture
3. Consolidated functionality in core modules

## Functions to Remove

The following edge functions can be safely removed:

### Caption Processing Functions

These functions have been replaced by database functions:

- `analyze-with-ai` - Replaced by `xdelo_process_caption_workflow` database function
- `parse-caption-with-ai` - Replaced by direct database caption processing

### External Integration Functions

No longer needed due to removing Make.com and n8n dependencies:

- `make-webhook-sender` - Make.com integration no longer used
- `make-webhook-tester` - Testing utility for Make.com
- `make-webhook-retry` - Retry mechanism for Make.com
- `make-event-log-cleaner` - Maintenance utility for Make.com events
- `xdelo_make-webhook-sender` - Updated Make.com integration
- `xdelo_make-webhook-retry` - Updated retry mechanism

### Duplicate Functionality

Functions with duplicate functionality:

- `delete-telegram-message` - Replaced by `xdelo_delete_message`
- `redownload-missing-files` - Functionality moved to database

## Cleanup Process

To remove these functions:

1. Update the `supabase/functions/config.toml` file to remove references to these functions
2. Delete the function directories from the `supabase/functions/` folder
3. Deploy the updated configuration:
   ```bash
   supabase functions deploy
   ```

4. Remove any frontend code that references these functions:
   - Update `src/lib/api.ts` to remove function references
   - Update hooks that might call these functions

## Verification Steps

After removing deprecated functions:

1. Verify that the replacement functionality works correctly
2. Check logs for any attempted calls to removed functions
3. Run tests to ensure no functionality is broken

## Documentation Updates

After removing these functions, update the following documentation:

- Update `docs/edge-functions.md` to reflect current state
- Update README files to remove references to deprecated functions

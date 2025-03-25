# Message Processing Migration Guide

This guide provides instructions for deploying the simplified message processing architecture.

## Overview

This migration:

1. Replaces edge functions with direct database processing
2. Removes external integrations (Make.com, n8n)
3. Ensures consistent UUID string handling
4. Updates frontend code to use database functions directly

## Deployment Steps

### 1. Deploy Database Changes

Run the cleanup SQL script:

```bash
# Connect to your database
psql <CONNECTION_STRING> -f cleanup-external-integrations.sql
```

This script:
- Drops unused triggers and functions
- Ensures correlation IDs are stored as strings
- Logs the cleanup to the audit system

### 2. Deploy Frontend Code

The following files have been updated:

- `src/hooks/useMessageAnalysis.ts` - Uses `xdelo_process_caption_workflow` instead of edge function
- `src/hooks/useMediaUtils.tsx` - Uses `xdelo_sync_media_group_content` instead of edge function
- `src/lib/mediaOperations.ts` - Uses database functions instead of edge functions
- `src/lib/api.ts` - Updated API helper functions
- `src/lib/mediaGroupSync.ts` - Uses database functions directly

Deploy these changes using your normal deployment process.

### 3. Update Edge Function Configuration

The `config.toml` file has been updated to remove deprecated functions:

```toml
# Removed entries for analyze-with-ai and parse-caption-with-ai
```

Deploy the updated config:

```bash
supabase functions deploy
```

### 4. Verify Deployment

1. Check that message processing still works:
   - Send a new message with a caption
   - Verify it's processed automatically
   - Check the analyzed content in the database

2. Test media group synchronization:
   - Send a media group message with caption
   - Verify all messages in the group receive the same analyzed content

3. Check for any errors in logs:
   - Review Supabase logs for any issues
   - Check application logs for frontend errors

## Rollback Plan

If issues occur, you can temporarily roll back to the previous processing flow:

1. Restore the removed edge functions
2. Reinstate the external integration triggers
3. Update the config.toml file
4. Revert frontend code changes

## Documentation

New documentation has been added:

- `docs/direct-caption-processing.md` - Describes the new processing flow 
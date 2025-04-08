# Function Consolidation Implementation Guide

This document provides step-by-step instructions for implementing the edge function consolidation plan. Follow these steps in order to safely transition from the old structure to the new consolidated one.

## Prerequisites

- Supabase CLI installed and configured
- Access to the Supabase project
- Node.js and npm installed

## Implementation Steps

### Step 1: Create the SQL Migration

1. Apply the SQL migration to ensure all required database functions exist:

```bash
npx supabase migration up
```

This migration will create or update:
- `xdelo_logprocessingevent` compatibility wrapper
- `xdelo_process_caption_workflow` function
- `xdelo_update_message_state` function
- `xdelo_sync_media_group` function
- Monitoring views for operations

### Step 2: Deploy the Consolidated Functions

1. Deploy the new consolidated functions:

```bash
# Deploy the message processor
npx supabase functions deploy message-processor

# Deploy the media processor
npx supabase functions deploy media-processor
```

2. Verify the functions are deployed correctly:

```bash
npx supabase functions list
```

### Step 3: Update Frontend Code

Update any frontend code to use the new consolidated endpoints:

#### Old vs New Function Mappings

| Old Function | New Function | Action Parameter |
|--------------|--------------|------------------|
| `manual-caption-parser` | `message-processor` | `"action": "parse_caption"` |
| `parse-caption-with-ai` | `message-processor` | `"action": "analyze_with_ai"` |
| `sync-media-group` | `message-processor` | `"action": "process_media_group"` |
| `media-management` | `media-processor` | Various (see below) |
| `validate-storage-files` | `media-processor` | `"action": "validate_files"` |
| `repair-media` | `media-processor` | `"action": "repair_metadata"` |

#### Example Code Updates

From:
```javascript
const { data, error } = await supabase.functions.invoke('manual-caption-parser', {
  body: { messageId: 'uuid', correlationId: 'id' }
});
```

To:
```javascript
const { data, error } = await supabase.functions.invoke('message-processor', {
  body: { 
    action: 'parse_caption', 
    messageId: 'uuid', 
    correlationId: 'id' 
  }
});
```

### Step 4: Test the New Functions

1. Test each consolidated function with sample requests:

```bash
# Test message-processor for caption parsing
curl -X POST "https://xjhhehxcxkiumnwbirel.supabase.co/functions/v1/message-processor" \
  -H "Content-Type: application/json" \
  -d '{"action":"parse_caption","messageId":"a-valid-message-uuid"}'

# Test media-processor for file validation
curl -X POST "https://xjhhehxcxkiumnwbirel.supabase.co/functions/v1/media-processor" \
  -H "Content-Type: application/json" \
  -d '{"action":"validate_files","messageIds":["a-valid-message-uuid"]}'
```

2. Check logs for errors:

```bash
npx supabase functions logs message-processor
npx supabase functions logs media-processor
```

3. Verify database logging in the `unified_audit_logs` table:

```sql
SELECT * FROM unified_audit_logs 
ORDER BY created_at DESC 
LIMIT 50;
```

### Step 5: Run the Cleanup Script

Once all tests are passed and you're confident in the new functions, run the cleanup script:

```bash
cd supabase
chmod +x sync-functions.sh
./sync-functions.sh
```

This script will:
1. Remove deprecated function directories
2. Verify consolidated functions exist
3. Check shared utilities
4. Redeploy consolidated functions

### Step 6: Monitor Operations

Use the newly created monitoring views to track function operations:

```sql
-- Monitor all function operations
SELECT * FROM v_function_operations;

-- Monitor media group operations specifically
SELECT * FROM v_media_group_operations;
```

Look for any errors or unusual patterns that might indicate issues with the consolidated functions.

## Rollback Plan

If issues are encountered, you can temporarily revert to the old functions:

1. Restore the old function directories from Git history:

```bash
git checkout HEAD~1 -- supabase/functions/manual-caption-parser
git checkout HEAD~1 -- supabase/functions/parse-caption-with-ai
# etc. for each removed directory
```

2. Redeploy the old functions:

```bash
npx supabase functions deploy manual-caption-parser
npx supabase functions deploy parse-caption-with-ai
# etc. for each restored function
```

3. Update frontend code to use the old endpoints until issues are resolved.

## Next Steps

After successful consolidation of these functions, proceed with:

1. Creating the unified `ai-service` function
2. Creating the unified `product-service` function 
3. Updating the `telegram-webhook` function to use consolidated utilities 
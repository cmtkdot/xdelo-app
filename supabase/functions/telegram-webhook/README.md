# Telegram Webhook Function

This Edge Function handles incoming webhook events from the Telegram Bot API. It processes messages, media, and edits, storing them in the database for further processing.

## Features

- Processes text messages, photos, and videos
- Handles edited messages and channel posts
- Tracks edit history for messages
- Syncs content across media groups
- Uses correlation IDs for request tracking

## Edit History Handling

The webhook now properly tracks edit history for both media and text messages. When a message is edited, the previous content is stored in the `edit_history` field as a JSONB array. Each entry in the array contains:

- `edit_date`: When the edit was made
- `previous_caption`: The caption before the edit
- `new_caption`: The caption after the edit
- `is_channel_post`: Whether the edit was made in a channel

This allows for tracking the full history of edits to a message, which can be useful for auditing and debugging.

## Database Changes

The following database changes were made to support edit history:

1. Added indexes for `edited_channel_post` and `update_id` fields
2. Added a GIN index for the `edit_history` JSONB field
3. Added a trigger to automatically update the `edit_history` field when a message is edited

## Code Structure

- `index.ts`: Main webhook handler
- `utils/dbOperations.ts`: Database operations for messages
- `utils/mediaUtils.ts`: Media processing utilities
- `utils/logger.ts`: Logging utility with correlation IDs
- `types.ts`: TypeScript interfaces and types

## Media Processing

The webhook now uses an improved media processing flow:

1. `extractMediaInfo`: Extracts media information from Telegram messages
2. `downloadMedia`: Downloads media from Telegram and stores it in Supabase storage
   - Checks if the file already exists in storage
   - Downloads the file from Telegram if needed
   - Uploads to Supabase storage with proper error handling
   - Returns the public URL for storage in the message record
3. `downloadAndStoreMedia`: Legacy function maintained for backward compatibility

## Flow

1. Webhook receives an update from Telegram
2. Determines if it's a new message or an edit
3. For edits, retrieves the existing message and updates the edit history
4. For media messages, processes and stores the media using `downloadMedia`
5. For media groups, syncs content across all messages in the group
6. For messages with captions, triggers analysis

## Deployment

Deploy this function to Supabase Edge Functions:

```bash
supabase functions deploy telegram-webhook
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token

## Troubleshooting

If you encounter issues with the webhook:

1. Check the logs for errors
2. Verify that the webhook URL is correctly set in the Telegram Bot API
3. Ensure that the database schema matches the expected structure
4. Check that the environment variables are correctly set

import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { xdelo_verifyFileExists, xdelo_downloadMediaFromTelegram, xdelo_uploadMediaToStorage } from '../_shared/mediaUtils.ts';

// Define Telegram bot token access for edge function
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
}

// Define message structure
interface Message {
  id: string;
  file_id: string;
  file_unique_id: string;
  storage_path?: string;
  mime_type?: string;
  needs_redownload?: boolean;
  redownload_attempts?: number;
  telegram_data?: any;
}

// Define simplified response structure
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request parameters
    const { messageIds, limit = 50, checkStorageOnly = false } = await req.json();
    
    console.log(`Starting unified media repair with params:`, { 
      messageIds: messageIds?.length || 0, 
      limit, 
      checkStorageOnly 
    });

    // Build the query to fetch messages that need repair
    let query = supabaseClient
      .from('messages')
      .select('id, file_id, file_unique_id, storage_path, mime_type, needs_redownload, redownload_attempts, telegram_data, storage_exists')
      .eq('deleted_from_telegram', false)
      .is('file_id', 'not.null')
      .is('file_unique_id', 'not.null');

    // If specific message IDs are provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, prioritize messages marked for redownload or with missing files
      query = query
        .or('needs_redownload.eq.true,storage_exists.eq.false')
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    // Fetch the messages
    const { data: messages, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Database query error: ${queryError.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No messages found that need repair.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${messages.length} messages to process`);

    // Initialize results tracking
    const results = {
      processed: messages.length,
      repaired: 0,
      verified: 0,
      failed: 0,
      details: []
    };

    // Process each message
    for (const message of messages) {
      try {
        // Verify if file exists in storage
        let storageExists = false;
        
        if (message.storage_path) {
          storageExists = await xdelo_verifyFileExists(
            supabaseClient,
            message.storage_path,
            'telegram-media'
          );
        }

        // If storage exists and we're only checking, mark as verified
        if (storageExists && checkStorageOnly) {
          // Update the database to reflect that storage exists
          await supabaseClient
            .from('messages')
            .update({
              storage_exists: true,
              needs_redownload: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);

          results.verified++;
          results.details.push({
            message_id: message.id,
            action: 'verified',
            storage_path: message.storage_path
          });
          continue;
        }

        // If storage doesn't exist or we're forcing redownload, attempt repair
        if (!storageExists || !checkStorageOnly) {
          // Skip if no file_id or file_unique_id
          if (!message.file_id || !message.file_unique_id) {
            results.failed++;
            results.details.push({
              message_id: message.id,
              action: 'failed',
              reason: 'Missing file_id or file_unique_id'
            });
            continue;
          }

          console.log(`Repairing message ${message.id} with file ${message.file_unique_id}`);
          
          // Download the file from Telegram
          const downloadResult = await xdelo_downloadMediaFromTelegram(
            message.file_id,
            message.file_unique_id,
            message.mime_type || 'application/octet-stream',
            TELEGRAM_BOT_TOKEN
          );
          
          if (!downloadResult.success || !downloadResult.blob) {
            throw new Error(downloadResult.error || 'Failed to download media from Telegram');
          }

          // Upload to storage with proper content type and disposition
          const uploadResult = await xdelo_uploadMediaToStorage(
            downloadResult.storagePath,
            downloadResult.blob,
            downloadResult.mimeType || message.mime_type || 'application/octet-stream',
            message.id // Pass message ID for direct update
          );
          
          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload media to storage');
          }

          results.repaired++;
          results.details.push({
            message_id: message.id,
            action: 'repaired',
            old_path: message.storage_path,
            new_path: downloadResult.storagePath
          });
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        
        // Update the message with the error
        try {
          await supabaseClient
            .from('messages')
            .update({
              error_message: `Repair failed: ${error.message}`,
              error_code: 'REPAIR_FAILED',
              redownload_attempts: (message.redownload_attempts || 0) + 1,
              last_error_at: new Date().toISOString()
            })
            .eq('id', message.id);
        } catch (updateError) {
          console.error('Failed to update error state:', updateError);
        }

        results.failed++;
        results.details.push({
          message_id: message.id,
          action: 'failed',
          error: error.message
        });
      }
    }

    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unified media repair error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

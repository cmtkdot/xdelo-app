import { supabaseClient as supabase } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  xdelo_downloadMediaFromTelegram, 
  xdelo_uploadMediaToStorage,
  xdelo_verifyFileExists,
  xdelo_generateStoragePath
} from '../_shared/mediaUtils.ts';

// Declare Deno for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  }
};

// Get token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN');
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageIds, limit = 50, checkStorageOnly = false } = await req.json();
    
    // If specific message IDs provided, repair those
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      return await handleSpecificMessages(messageIds, checkStorageOnly);
    } 
    
    // Otherwise repair messages with issues
    return await handleMessagesWithIssues(limit, checkStorageOnly);
  } catch (error) {
    console.error('Error in edge function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Handle repair for specific messages
async function handleSpecificMessages(messageIds: string[], checkStorageOnly: boolean) {
  const results = {
    processed: messageIds.length,
    repaired: 0,
    verified: 0,
    failed: 0,
    details: [] as any[]
  };

  // Get message details
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .in('id', messageIds);

  if (error) {
    throw new Error(`Error fetching messages: ${error.message}`);
  }

  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No messages found with the provided IDs'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Process each message
  for (const message of messages) {
    try {
      // Verify if file exists in storage
      const exists = message.storage_path ? 
        await xdelo_verifyFileExists(supabase, message.storage_path) : 
        false;

      if (exists) {
        // If file exists and we're only checking, mark as verified
        if (checkStorageOnly) {
          results.verified++;
          results.details.push({
            messageId: message.id,
            status: 'verified',
            storagePath: message.storage_path
          });
          continue;
        }
      }

      // If we're only checking or file doesn't exist, try to repair
      if (!checkStorageOnly || !exists) {
        // Skip if missing required data
        if (!message.file_id || !message.file_unique_id) {
          results.failed++;
          results.details.push({
            messageId: message.id,
            status: 'failed',
            reason: 'Missing file_id or file_unique_id'
          });
          continue;
        }

        // Download from Telegram
        const downloadResult = await xdelo_downloadMediaFromTelegram(
          message.file_id,
          message.file_unique_id,
          message.mime_type || 'application/octet-stream',
          TELEGRAM_BOT_TOKEN
        );

        if (!downloadResult.success || !downloadResult.blob) {
          results.failed++;
          results.details.push({
            messageId: message.id,
            status: 'failed',
            reason: downloadResult.error || 'Download failed'
          });
          continue;
        }

        // Upload to storage
        const uploadResult = await xdelo_uploadMediaToStorage(
          downloadResult.storagePath,
          downloadResult.blob,
          downloadResult.mimeType || message.mime_type || 'application/octet-stream',
          message.id
        );

        if (!uploadResult.success) {
          results.failed++;
          results.details.push({
            messageId: message.id,
            status: 'failed',
            reason: uploadResult.error || 'Upload failed'
          });
          continue;
        }

        // Mark success
        results.repaired++;
        results.details.push({
          messageId: message.id,
          status: 'repaired',
          storagePath: downloadResult.storagePath,
          publicUrl: uploadResult.publicUrl
        });

        // Update message
        await supabase
          .from('messages')
          .update({
            needs_redownload: false,
            storage_exists: true,
            storage_path_standardized: true,
            redownload_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
      }
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      results.failed++;
      results.details.push({
        messageId: message.id,
        status: 'error',
        error: error.message
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      results
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Handle messages with known issues
async function handleMessagesWithIssues(limit: number, checkStorageOnly: boolean) {
  // Get messages flagged for redownload
  const { data: messagesNeedingRepair, error } = await supabase
    .from('messages')
    .select('*')
    .eq('needs_redownload', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error fetching messages: ${error.message}`);
  }

  // If no flagged messages, check for missing storage
  let messagesToProcess = messagesNeedingRepair || [];
  if (messagesToProcess.length < limit) {
    const remainingLimit = limit - messagesToProcess.length;
    
    const { data: messagesWithoutStorage, error: storageError } = await supabase
      .from('messages')
      .select('*')
      .eq('storage_exists', false)
      .is('deleted_from_telegram', false)
      .order('updated_at', { ascending: false })
      .limit(remainingLimit);

    if (!storageError && messagesWithoutStorage) {
      messagesToProcess = [...messagesToProcess, ...messagesWithoutStorage];
    }
  }

  // If we still need more, check for non-standardized paths
  if (messagesToProcess.length < limit) {
    const remainingLimit = limit - messagesToProcess.length;
    
    const { data: messagesNonStandard, error: standardError } = await supabase
      .from('messages')
      .select('*')
      .eq('storage_path_standardized', false)
      .is('deleted_from_telegram', false)
      .order('updated_at', { ascending: false })
      .limit(remainingLimit);

    if (!standardError && messagesNonStandard) {
      messagesToProcess = [...messagesToProcess, ...messagesNonStandard];
    }
  }

  // If messages found, process them
  if (messagesToProcess.length > 0) {
    return await handleSpecificMessages(
      messagesToProcess.map(m => m.id),
      checkStorageOnly
    );
  }

  // If no issues found, return success
  return new Response(
    JSON.stringify({
      success: true,
      message: 'No messages with known issues found',
      checked: limit
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

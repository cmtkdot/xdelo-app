
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { 
  xdelo_downloadMediaFromTelegram, 
  xdelo_uploadMediaToStorage,
  xdelo_isViewableMimeType,
  xdelo_generateStoragePath
} from '../_shared/mediaUtils.ts';
import { Message, ProcessingState } from '../_shared/types.ts';

// Define Deno fetch event type
interface FetchEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

// Set CORS headers for browser API requests
const corsHeadersObj = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!telegramBotToken) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable not set');
}

// Main handler for all HTTP methods
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeadersObj,
    });
  }

  try {
    // Parse the request body
    const { messageIds, messageId, forceRedownload, limit = 100, repairAll = false } = await req.json();

    // Determine the mode of operation
    if (messageId) {
      // Process a single message by ID
      const result = await repairSingleMessage(messageId, forceRedownload);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeadersObj,
      });
    } else if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Process a batch of specific messages
      const result = await repairMultipleMessages(messageIds);
      return new Response(JSON.stringify(result), {
        status: 200, 
        headers: corsHeadersObj,
      });
    } else if (repairAll) {
      // Process all messages needing repair (up to the limit)
      const result = await repairAllMessages(limit);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeadersObj,
      });
    } else {
      throw new Error('Invalid request: Must provide messageId, messageIds, or set repairAll=true');
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: corsHeadersObj
    });
  }
});

// Repair a single message
async function repairSingleMessage(messageId: string, forceRedownload = false): Promise<any> {
  console.log(`Repairing single message: ${messageId}, force redownload: ${forceRedownload}`);
  
  // Update state to processing
  await supabaseClient
    .from('messages')
    .update({
      processing_state: 'processing' as ProcessingState,
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId);
  
  try {
    // Fetch the message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      throw new Error(`Failed to fetch message: ${messageError?.message || 'Message not found'}`);
    }
    
    // Check if the file exists in storage
    let existingStorage = false;
    if (message.storage_path && !forceRedownload) {
      const { data: storageData } = await supabaseClient.storage
        .from('telegram-media')
        .createSignedUrl(message.storage_path, 60);
        
      existingStorage = !!storageData;
    }
    
    // If storage exists and we're not forcing redownload, just update meta
    if (existingStorage && !forceRedownload) {
      console.log(`File exists in storage: ${message.storage_path}, updating metadata only`);
      const fixResult = await fixMessageMetadata(message);
      
      // Mark as completed
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'completed' as ProcessingState,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      return {
        success: true,
        message: 'File exists, metadata updated',
        existingStorage: true,
        ...fixResult
      };
    }
    
    // If we got here, we need to redownload the file or fix storage issues
    console.log(`Redownloading file from Telegram: ${message.file_id}`);
    
    if (!message.file_id || !message.file_unique_id) {
      throw new Error('Message is missing file_id or file_unique_id');
    }
    
    // Download the file from Telegram
    const download = await xdelo_downloadMediaFromTelegram(
      message.file_id,
      message.file_unique_id,
      message.mime_type || 'application/octet-stream',
      telegramBotToken
    );
    
    if (!download.success || !download.blob) {
      throw new Error(download.error || 'Failed to download file from Telegram');
    }
    
    // Generate the storage path if needed
    const storagePath = download.storagePath || xdelo_generateStoragePath(
      message.file_unique_id,
      download.mimeType || message.mime_type || 'application/octet-stream'
    );
    
    // Upload to storage
    const upload = await xdelo_uploadMediaToStorage(
      storagePath,
      download.blob,
      download.mimeType || message.mime_type || 'application/octet-stream',
      messageId
    );
    
    if (!upload.success) {
      throw new Error(upload.error || 'Failed to upload file to storage');
    }
    
    // Update content disposition based on MIME type
    const isViewable = xdelo_isViewableMimeType(
      download.mimeType || message.mime_type || 'application/octet-stream'
    );
    
    // Update the message
    await supabaseClient
      .from('messages')
      .update({
        storage_path: storagePath,
        public_url: upload.publicUrl,
        storage_exists: true,
        storage_path_standardized: true,
        mime_type: download.mimeType || message.mime_type,
        mime_type_verified: true,
        content_disposition: isViewable ? 'inline' : 'attachment',
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        processing_state: 'completed' as ProcessingState,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    return {
      success: true,
      message: 'File successfully downloaded and uploaded to storage',
      storagePath,
      publicUrl: upload.publicUrl,
      mimeType: download.mimeType || message.mime_type
    };
  } catch (error) {
    console.error(`Error repairing message ${messageId}:`, error);
    
    // Update state to error
    await supabaseClient
      .from('messages')
      .update({
        processing_state: 'error' as ProcessingState,
        error_message: error.message || 'Unknown error during repair',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    return {
      success: false,
      error: error.message || 'Unknown error during repair'
    };
  }
}

// Fix metadata for a message
async function fixMessageMetadata(message: Message): Promise<any> {
  // Determine content disposition from MIME type
  const isViewable = xdelo_isViewableMimeType(message.mime_type || 'application/octet-stream');
  const contentDisposition = isViewable ? 'inline' : 'attachment';
  
  // Update storage metadata
  try {
    // Only update storage if the path exists
    if (message.storage_path) {
      const { data: fileInfo, error: fileError } = await supabaseClient.storage
        .from('telegram-media')
        .updateBucket({
          id: 'telegram-media',
          options: {
            public: true
          }
        });
        
      // Mark file as public
      const { error: metadataError } = await supabaseClient.storage
        .from('telegram-media')
        .update(message.storage_path, new Blob([]), {
          contentType: message.mime_type || 'application/octet-stream',
          cacheControl: '3600',
          contentDisposition,
          upsert: false
        });
        
      if (metadataError) {
        console.warn(`Couldn't update storage metadata: ${metadataError.message}`, metadataError);
      }
    }
    
    // Generate public URL if missing
    let publicUrl = message.public_url;
    if (!publicUrl && message.storage_path) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${message.storage_path}`;
    }
    
    // Update the message
    await supabaseClient
      .from('messages')
      .update({
        content_disposition: contentDisposition,
        mime_type_verified: true,
        storage_exists: true,
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', message.id);
      
    return {
      success: true,
      contentDisposition,
      publicUrl
    };
  } catch (error) {
    console.error(`Error fixing metadata for message ${message.id}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Repair multiple messages
async function repairMultipleMessages(messageIds: string[]): Promise<any> {
  console.log(`Repairing multiple messages: ${messageIds.length} messages`);
  
  const results = {
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (const messageId of messageIds) {
    try {
      const result = await repairSingleMessage(messageId);
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
      results.details.push({
        messageId,
        success: result.success,
        message: result.message || result.error
      });
    } catch (error) {
      console.error(`Error repairing message ${messageId}:`, error);
      results.failed++;
      results.details.push({
        messageId,
        success: false,
        message: error.message
      });
    }
  }
  
  return {
    success: results.successful > 0,
    message: `Repaired ${results.successful} of ${messageIds.length} messages`,
    ...results
  };
}

// Repair all messages that need it
async function repairAllMessages(limit: number): Promise<any> {
  console.log(`Repairing all messages that need it (up to ${limit})`);
  
  // Find messages that need repair
  const { data: messagesToFix, error: queryError } = await supabaseClient
    .from('messages')
    .select('id')
    .or('storage_exists.is.null,storage_exists.eq.false,needs_redownload.eq.true,processing_state.eq.error')
    .not('file_id', 'is', null)
    .limit(limit);
    
  if (queryError) {
    throw new Error(`Failed to query messages: ${queryError.message}`);
  }
  
  if (!messagesToFix || messagesToFix.length === 0) {
    return {
      success: true,
      message: 'No messages need repair',
      successful: 0,
      failed: 0
    };
  }
  
  const messageIds = messagesToFix.map(m => m.id);
  return await repairMultipleMessages(messageIds);
}

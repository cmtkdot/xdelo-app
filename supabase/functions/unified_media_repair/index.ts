
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { 
  downloadMediaFromTelegram, 
  uploadMediaToStorage,
  isViewableMimeType,
  generateStoragePath
} from '../_shared/mediaUtils.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
      processing_state: 'processing',
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
          processing_state: 'completed',
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
    const download = await downloadMediaFromTelegram(
      message.file_id,
      message.file_unique_id,
      message.mime_type || 'application/octet-stream',
      telegramBotToken
    );
    
    if (!download.success || !download.blob) {
      throw new Error(download.error || 'Failed to download file from Telegram');
    }
    
    // Generate the storage path if needed
    const storagePath = download.storagePath || generateStoragePath(
      message.file_unique_id,
      download.mimeType || message.mime_type || 'application/octet-stream'
    );
    
    // Upload to storage
    const upload = await uploadMediaToStorage(
      storagePath,
      download.blob,
      download.mimeType || message.mime_type || 'application/octet-stream',
      messageId
    );
    
    if (!upload.success) {
      throw new Error(upload.error || 'Failed to upload file to storage');
    }
    
    // Update content disposition based on MIME type
    const isViewable = isViewableMimeType(
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
        processing_state: 'completed',
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
        processing_state: 'error',
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
async function fixMessageMetadata(message: any): Promise<any> {
  // Determine content disposition from MIME type
  const isViewable = isViewableMimeType(message.mime_type || 'application/octet-stream');
  const contentDisposition = isViewable ? 'inline' : 'attachment';
  
  // Update storage metadata
  try {
    // Only update storage if the path exists
    if (message.storage_path) {
      // Update file metadata
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
    
    // Update the message record
    await supabaseClient
      .from('messages')
      .update({
        public_url: publicUrl,
        content_disposition: contentDisposition,
        mime_type_verified: true,
        storage_exists: true,
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
      error: error.message || 'Unknown error during metadata fix'
    };
  }
}

// Repair multiple messages in a batch
async function repairMultipleMessages(messageIds: string[]): Promise<any> {
  console.log(`Repairing multiple messages: ${messageIds.length} messages`);
  
  const results = {
    success: true,
    total: messageIds.length,
    succeeded: 0,
    failed: 0,
    details: [] as any[]
  };
  
  // Process messages in sequence to avoid overwhelming the system
  for (const messageId of messageIds) {
    try {
      const result = await repairSingleMessage(messageId, false);
      results.details.push({
        messageId,
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`Error repairing message ${messageId}:`, error);
      results.failed++;
      results.details.push({
        messageId,
        success: false,
        error: error.message || 'Unknown error'
      });
    }
  }
  
  return results;
}

// Repair all messages needing repair
async function repairAllMessages(limit: number): Promise<any> {
  console.log(`Repairing all messages needing repair, limit: ${limit}`);
  
  // Find messages needing repair
  const { data: messages, error } = await supabaseClient
    .from('messages')
    .select('id')
    .or('storage_exists.is.null,storage_exists.eq.false,needs_redownload.eq.true')
    .limit(limit);
    
  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }
  
  if (!messages || messages.length === 0) {
    return {
      success: true,
      message: 'No messages need repair',
      total: 0
    };
  }
  
  // Extract message IDs
  const messageIds = messages.map(m => m.id);
  
  // Repair the messages
  return await repairMultipleMessages(messageIds);
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { TelegramClient } from "https://deno.land/x/telegram@v0.2.0/client.ts";
import { Api } from "https://deno.land/x/telegram@v0.2.0/mod.ts";
import { bigInt } from "https://deno.land/x/telegram@v0.2.0/deps.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Telegram configurations
const telegramApiId = Number(Deno.env.get('TELEGRAM_API_ID'));
const telegramApiHash = Deno.env.get('TELEGRAM_API_HASH') ?? '';
const telegramSessionString = Deno.env.get('TELEGRAM_SESSION_STRING') ?? '';

// Initialize Telegram client
const client = new TelegramClient(telegramSessionString, telegramApiId, telegramApiHash, {
  useIPV6: false,
  testServers: false,
});

// Function to validate if a file exists based on its public URL
async function fileExists(publicURL: string): Promise<boolean> {
  try {
    const response = await fetch(publicURL, { method: 'HEAD' });
    return response.status !== 404;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

// Function to download file from Telegram and upload to Supabase storage
async function downloadFile(fileId: string, fileUniqueId: string, mimeType: string): Promise<string | null> {
  try {
    if (!client.connected) {
      await client.connect();
    }

    const file = await client.invoke(
      new Api.upload.GetFile({
        precise: false,
        cdnSupported: false,
        location: new Api.InputFileLocation({
          volumeId: bigInt(parseInt(fileId.split('_')[0])),
          localId: parseInt(fileId.split('_')[1]),
          secret: bigInt(parseInt(fileId.split('_')[2])),
          fileReference: Buffer.from(fileUniqueId)
        }),
        offset: bigInt(0),
        limit: 1024 * 1024, // 1MB chunks
      })
    );

    if (!file) {
      throw new Error('Failed to get file from Telegram.');
    }

    const fileData = file.bytes;
    if (!fileData) {
      throw new Error('No data received from Telegram.');
    }

    const fileName = `${fileUniqueId}.${mimeType.split('/')[1]}`;
    const storagePath = `telegram-media/${fileName}`;

    // Upload the file to Supabase storage
    const { data, error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`);
    }

    // Generate the public URL
    const publicURL = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/${storagePath}`;

    return publicURL;
  } catch (error) {
    console.error('Error downloading and uploading file:', error);
    throw error;
  }
}

// Main function to handle redownloading missing files
async function redownloadMissingFile(message: any) {
  // Validate required fields
  if (!message.file_id || !message.file_unique_id || !message.mime_type) {
    throw new Error(`Missing required fields for message ${message.id}.`);
  }

  // Check if the file already exists
  if (message.public_url && await fileExists(message.public_url)) {
    console.log(`File already exists for message ${message.id}.`);
    return {
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      success: true,
      public_url: message.public_url
    };
  }

  // Attempt to download the file from Telegram
  const publicURL = await downloadFile(message.file_id, message.file_unique_id, message.mime_type);

  if (!publicURL) {
    throw new Error(`Failed to download file for message ${message.id}.`);
  }

  // After successful download, update the message status
  await supabase
    .from('messages')
    .update({
      needs_redownload: false,
      redownload_completed_at: new Date().toISOString(),
      redownload_attempts: (message.redownload_attempts || 0) + 1,
      error_message: null,
      public_url: publicURL,
      storage_path: `telegram-media/${message.file_unique_id}.${message.mime_type.split('/')[1]}`
    })
    .eq('id', message.id);
  
  // Return success information
  return {
    message_id: message.id,
    file_unique_id: message.file_unique_id,
    success: true,
    public_url: message.public_url
  };
}

// Serve the HTTP request
serve(async (req) => {
  try {
    const { messageIds, limit = 10 } = await req.json();
    
    // Get messages that need redownload
    let query = supabase
      .from('messages')
      .select('*')
      .limit(limit);
    
    // If specific message IDs were provided, use them
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise get messages flagged for redownload
      query = query.eq('needs_redownload', true);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const successful = [];
    const failed = [];
    
    // Process each message sequentially
    for (const message of messages) {
      try {
        // Attempt to redownload the media file
        const result = await redownloadMissingFile(message);
        
        // Update message status after successful redownload
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            needs_redownload: false,
            redownload_completed_at: new Date().toISOString(),
            redownload_attempts: (message.redownload_attempts || 0) + 1,
            error_message: null
          })
          .eq('id', message.id);
          
        if (updateError) {
          console.error(`Error updating message ${message.id} status after redownload:`, updateError);
        }
        
        successful.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: true,
          public_url: result.public_url
        });
      } catch (error) {
        console.error(`Error redownloading file for message ${message.id}:`, error);
        
        // Update message with error information
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            redownload_attempts: (message.redownload_attempts || 0) + 1,
            error_message: error.message
          })
          .eq('id', message.id);
          
        if (updateError) {
          console.error(`Error updating message ${message.id} error status:`, updateError);
        }
        
        failed.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: false,
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        successful: successful.length,
        failed: failed.length,
        results
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: corsHeaders }
    );
  }
});

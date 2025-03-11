
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Function to download file from another message in the same media group
async function downloadFromMediaGroup(message: any): Promise<string | null> {
  try {
    // Exit early if no media group ID
    if (!message.media_group_id) {
      throw new Error('Message is not part of a media group');
    }

    console.log(`Searching media group ${message.media_group_id} for file ${message.file_unique_id}`);

    // Get standardized storage path first
    const { data: storagePath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type
      }
    );

    if (pathError) {
      console.error(`Error getting standardized path: ${pathError.message}`);
      throw pathError;
    }

    // Find another message in the same media group with the same file_unique_id
    // that has a valid public_url
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('id, public_url, storage_path')
      .eq('media_group_id', message.media_group_id)
      .eq('file_unique_id', message.file_unique_id)
      .neq('id', message.id) // Not the current message
      .order('created_at', { ascending: false });

    if (groupError) {
      throw new Error(`Failed to query media group: ${groupError.message}`);
    }

    if (!groupMessages || groupMessages.length === 0) {
      return null;
    }

    // Check each message for a working public URL
    for (const groupMessage of groupMessages) {
      if (groupMessage.public_url && await fileExists(groupMessage.public_url)) {
        console.log(`Found valid file in media group: ${groupMessage.id}`);

        // We found a working URL, now copy it to our message
        await supabase
          .from('messages')
          .update({
            public_url: groupMessage.public_url,
            storage_path: storagePath, // Use standardized path
            needs_redownload: false,
            redownload_completed_at: new Date().toISOString(),
            redownload_attempts: (message.redownload_attempts || 0) + 1,
            error_message: null
          })
          .eq('id', message.id);

        return groupMessage.public_url;
      }
    }
    
    // Try using the redownload-from-media-group endpoint as fallback
    try {
      console.log(`No valid URL found in group. Attempting redownload-from-media-group for message ${message.id}`);
      
      const redownloadResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/redownload-from-media-group`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            messageId: message.id,
            mediaGroupId: message.media_group_id,
            correlationId: crypto.randomUUID()
          })
        }
      );
      
      if (!redownloadResponse.ok) {
        const errorText = await redownloadResponse.text();
        console.error(`Redownload from media group failed: ${errorText}`);
        return null;
      }
      
      const result = await redownloadResponse.json();
      console.log(`Redownload from media group succeeded:`, result);
      
      return result.success ? 
        `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${result.storagePath}` : 
        null;
    } catch (redownloadError) {
      console.error('Error calling redownload function:', redownloadError);
      return null;
    }
  } catch (error) {
    console.error('Error downloading from media group:', error);
    throw error;
  }
}

// Function to download directly from Telegram API using bot token
async function downloadFromTelegram(message: any): Promise<string | null> {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('Telegram bot token not found in environment variables');
    }

    if (!message.file_id) {
      throw new Error('No file_id available for direct download');
    }

    // Get file path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.file_id}`;
    const getFileResponse = await fetch(getFileUrl);
    const getFileData = await getFileResponse.json();

    if (!getFileData.ok || !getFileData.result.file_path) {
      throw new Error(`Failed to get file path: ${JSON.stringify(getFileData)}`);
    }

    // Download the file using the file path
    const filePath = getFileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    // Get file data as blob
    const fileBlob = await fileResponse.blob();
    
    // Get standardized storage path
    const { data: storagePath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type
      }
    );

    if (pathError) {
      throw new Error(`Failed to get standardized path: ${pathError.message}`);
    }

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, fileBlob, {
        contentType: message.mime_type || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    // Get public URL
    const publicURL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;

    // Update message record
    await supabase
      .from('messages')
      .update({
        public_url: publicURL,
        storage_path: storagePath,
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        error_message: null,
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', message.id);

    return publicURL;
  } catch (error) {
    console.error('Error downloading from Telegram:', error);
    throw error;
  }
}

// Main function to handle redownloading missing files
async function redownloadMissingFile(message: any) {
  // Validate required fields
  if (!message.file_unique_id) {
    throw new Error(`Missing file_unique_id for message ${message.id}.`);
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

  // First try to download from media group (fastest option)
  if (message.media_group_id) {
    try {
      console.log(`Attempting media group download for message ${message.id}`);
      const publicURL = await downloadFromMediaGroup(message);
      if (publicURL) {
        return {
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: true,
          public_url: publicURL,
          method: 'media_group'
        };
      }
    } catch (error) {
      console.warn(`Media group download failed: ${error.message}`);
      // Continue to next method
    }
  }

  // If not found in media group, try direct Telegram download
  try {
    console.log(`Attempting direct Telegram download for message ${message.id}`);
    const publicURL = await downloadFromTelegram(message);
    if (publicURL) {
      return {
        message_id: message.id,
        file_unique_id: message.file_unique_id,
        success: true,
        public_url: publicURL,
        method: 'telegram_api'
      };
    }
  } catch (error) {
    console.error(`Telegram download failed: ${error.message}`);
    
    // Update the message status with error
    await supabase
      .from('messages')
      .update({
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        error_message: `Download failed: ${error.message}`
      })
      .eq('id', message.id);
    
    throw error;
  }

  throw new Error(`Failed to download file for message ${message.id}.`);
}

// Serve the HTTP request
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
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
        successful.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: true,
          public_url: result.public_url,
          method: result.method
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: corsHeaders }
    );
  }
});

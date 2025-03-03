
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get Telegram bot token
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN env variable');
}

interface RequestBody {
  messageId: string;
  mediaGroupId?: string;
  correlationId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, mediaGroupId, correlationId = crypto.randomUUID() } = await req.json() as RequestBody;
    
    if (!messageId) {
      throw new Error('messageId is required');
    }

    console.log(`Processing redownload for message: ${messageId}, correlation ID: ${correlationId}`);

    // Get the message that needs redownloading
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Failed to get message: ${messageError.message}`);
    }

    if (!message.file_unique_id) {
      throw new Error('Message has no file_unique_id to redownload');
    }

    // Determine which media group to use
    const groupId = mediaGroupId || message.media_group_id;
    
    if (!groupId) {
      throw new Error('No media group ID provided or associated with message');
    }

    // Find a valid file_id in the media group
    const { data: validFile, error: fileError } = await supabase.rpc(
      'xdelo_find_valid_file_id',
      {
        p_media_group_id: groupId,
        p_file_unique_id: message.file_unique_id
      }
    );

    if (fileError) {
      throw new Error(`Failed to find valid file_id: ${fileError.message}`);
    }

    if (!validFile) {
      throw new Error('No valid file_id found in media group');
    }

    console.log(`Found valid file_id for ${message.file_unique_id} in media group ${groupId}`);

    // Get file path from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${validFile}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Get correct storage path
    const { data: storagePath, error: storagePathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type
      }
    );

    if (storagePathError) {
      throw new Error(`Failed to get standardized storage path: ${storagePathError.message}`);
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: message.mime_type || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the message status
    const { data: updateResult, error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: validFile,
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        storage_path: storagePath,
        error_message: null
      })
      .eq('id', messageId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }

    // Log success 
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'file_redownloaded',
        entity_id: messageId,
        correlation_id: correlationId,
        metadata: {
          media_group_id: groupId,
          file_unique_id: message.file_unique_id,
          storage_path: storagePath,
          source: 'media_group'
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        fileUniqueId: message.file_unique_id,
        storagePath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in redownload-from-media-group:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

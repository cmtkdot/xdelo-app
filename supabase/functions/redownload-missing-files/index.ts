
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_fetchWithRetry } from "../_shared/mediaUtils/fetchUtils.ts";

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Logs operations for tracking and debugging
 */
async function logOperation(
  supabase: any,
  eventType: string,
  entityId: string,
  metadata: Record<string, any> = {},
  correlationId: string,
  errorMessage?: string
) {
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata,
        correlation_id: correlationId,
        error_message: errorMessage
      });
  } catch (err) {
    console.error('Error logging operation:', err);
  }
}

/**
 * Fetches a file from Telegram and uploads it to Supabase storage
 */
async function downloadAndStoreFile(
  supabase: any,
  fileId: string,
  storagePath: string,
  telegramToken: string,
  correlationId: string,
  messageId: string
): Promise<{ success: boolean; error?: string; newUrl?: string }> {
  console.log(`[${correlationId}] Attempting to redownload file ${fileId} to ${storagePath}`);
  
  try {
    // Step 1: Get the file path from Telegram
    console.log(`[${correlationId}] Getting file info from Telegram for ${fileId}`);
    const getFileUrl = `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`;
    
    const fileInfoResponse = await xdelo_fetchWithRetry(getFileUrl, {}, 5, 800);
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      const errorMsg = `Failed to get file path: ${fileInfo.description || 'Unknown error'}`;
      console.error(`[${correlationId}] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // Step 2: Download the file from Telegram
    console.log(`[${correlationId}] Downloading file from Telegram: ${fileInfo.result.file_path}`);
    const downloadUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.result.file_path}`;
    
    const fileResponse = await xdelo_fetchWithRetry(downloadUrl, {}, 5, 800);
    if (!fileResponse.ok) {
      const errorMsg = `Failed to download file: ${fileResponse.statusText}`;
      console.error(`[${correlationId}] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    const fileBlob = await fileResponse.blob();
    console.log(`[${correlationId}] Downloaded file size: ${fileBlob.size} bytes`);
    
    // Step 3: Upload to Supabase Storage
    console.log(`[${correlationId}] Uploading file to Supabase storage: ${storagePath}`);
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileBlob, {
        contentType: fileBlob.type,
        upsert: true,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error(`[${correlationId}] Upload error:`, uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Step 4: Get the public URL
    console.log(`[${correlationId}] Getting public URL for uploaded file`);
    const { data: urlData } = await supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    if (!urlData || !urlData.publicUrl) {
      const errorMsg = 'Failed to get public URL for file';
      console.error(`[${correlationId}] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // Step 5: Update the message record with the new URL and storage info
    console.log(`[${correlationId}] Updating message ${messageId} with new URL`);
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        public_url: urlData.publicUrl,
        storage_path: storagePath,
        storage_exists: true,
        needs_redownload: false,
        redownload_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (updateError) {
      console.error(`[${correlationId}] Update error:`, updateError);
      return { success: false, error: `Database update failed: ${updateError.message}` };
    }
    
    // Success
    console.log(`[${correlationId}] Successfully redownloaded and stored file for message ${messageId}`);
    return { 
      success: true,
      newUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error(`[${correlationId}] Error in downloadAndStoreFile:`, error);
    return { 
      success: false, 
      error: `Unexpected error: ${error.message}` 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create a correlation ID for this operation
  const correlationId = `repair_${crypto.randomUUID()}`;
  console.log(`[${correlationId}] Starting file repair operation`);

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    if (!telegramToken) {
      throw new Error('Missing Telegram Bot Token');
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body
    const { messageId, fileId, storagePath } = await req.json();
    console.log(`[${correlationId}] Repair parameters - messageId: ${messageId}, fileId: ${fileId}, storagePath: ${storagePath}`);
    
    if (!messageId || !fileId || !storagePath) {
      const errorMsg = 'Missing required parameters: messageId, fileId, and storagePath are required';
      console.error(`[${correlationId}] ${errorMsg}`);
      
      await logOperation(
        supabase, 
        'media_repair_failed', 
        messageId || 'unknown', 
        { error: errorMsg }, 
        correlationId,
        errorMsg
      );
      
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Log the start of the repair operation
    await logOperation(
      supabase,
      'media_repair_started',
      messageId,
      {
        file_id: fileId,
        storage_path: storagePath
      },
      correlationId
    );
    
    // Attempt to redownload and store the file
    const result = await downloadAndStoreFile(
      supabase,
      fileId,
      storagePath,
      telegramToken,
      correlationId,
      messageId
    );
    
    // Log the result
    if (result.success) {
      await logOperation(
        supabase,
        'media_repair_completed',
        messageId,
        {
          file_id: fileId,
          storage_path: storagePath,
          new_url: result.newUrl
        },
        correlationId
      );
      
      console.log(`[${correlationId}] Repair operation successful for message ${messageId}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'File successfully redownloaded',
          publicUrl: result.newUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      await logOperation(
        supabase,
        'media_repair_failed',
        messageId,
        {
          file_id: fileId,
          storage_path: storagePath,
          error: result.error
        },
        correlationId,
        result.error
      );
      
      console.error(`[${correlationId}] Repair operation failed: ${result.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}`,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

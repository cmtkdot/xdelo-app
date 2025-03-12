
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { xdelo_getUploadOptions } from "../_shared/mediaUtils.ts";

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
  messageId?: string;
  fileUniqueId?: string;
  repairType?: 'mime_type' | 'storage_path' | 'redownload';
  correlationId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, fileUniqueId, repairType = 'storage_path', correlationId = crypto.randomUUID() } = await req.json() as RequestBody;
    
    if (!messageId && !fileUniqueId) {
      throw new Error('Either messageId or fileUniqueId is required');
    }

    console.log(`Processing file repair: ${repairType}, messageId: ${messageId}, fileUniqueId: ${fileUniqueId}, correlation ID: ${correlationId}`);

    let message;
    
    // Get the message that needs repair
    if (messageId) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
        
      if (error) {
        throw new Error(`Failed to get message: ${error.message}`);
      }
      
      message = data;
    } else if (fileUniqueId) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('file_unique_id', fileUniqueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        throw new Error(`Failed to find message with file_unique_id ${fileUniqueId}: ${error.message}`);
      }
      
      message = data;
    }

    if (!message) {
      throw new Error('No message found to repair');
    }

    // Result to return
    const result: Record<string, any> = {
      messageId: message.id,
      fileUniqueId: message.file_unique_id,
      repairType,
      success: false
    };

    // Handle different repair types
    switch (repairType) {
      case 'mime_type': {
        // Fix MIME type
        const { data: detectedType, error: typeError } = await supabase.rpc(
          'xdelo_get_accurate_mime_type',
          { p_message_data: JSON.stringify(message) }
        );
        
        if (typeError) {
          throw new Error(`Failed to detect MIME type: ${typeError.message}`);
        }
        
        // Only update if detected type is different and not empty
        if (detectedType && detectedType !== message.mime_type) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              mime_type: detectedType,
              mime_type_original: message.mime_type,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
            
          if (updateError) {
            throw new Error(`Failed to update MIME type: ${updateError.message}`);
          }
          
          result.success = true;
          result.original = message.mime_type;
          result.updated = detectedType;
        } else {
          result.success = true;
          result.unchanged = true;
          result.mime_type = message.mime_type;
        }
        break;
      }
      
      case 'storage_path': {
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
        
        // If storage path is already correct, no need to update
        if (storagePath === message.storage_path) {
          result.success = true;
          result.unchanged = true;
          result.storage_path = storagePath;
          break;
        }
        
        // Check if the file exists at the current path
        let fileExists = false;
        if (message.storage_path) {
          try {
            const { data } = await supabase
              .storage
              .from('telegram-media')
              .download(message.storage_path);
              
            fileExists = !!data;
          } catch (error) {
            console.error('Error checking file existence:', error);
            fileExists = false;
          }
        }
        
        // If file exists at current path, move it to the new path
        if (fileExists) {
          try {
            // Download the file from the old path
            const { data: fileData, error: downloadError } = await supabase
              .storage
              .from('telegram-media')
              .download(message.storage_path);
              
            if (downloadError || !fileData) {
              throw new Error(`Failed to download from ${message.storage_path}: ${downloadError?.message}`);
            }
            
            // Upload to the new path
            const uploadOptions = xdelo_getUploadOptions(message.mime_type);
            const { error: uploadError } = await supabase
              .storage
              .from('telegram-media')
              .upload(storagePath, fileData, uploadOptions);
              
            if (uploadError) {
              throw new Error(`Failed to upload to ${storagePath}: ${uploadError.message}`);
            }
            
            // Delete the old file
            const { error: deleteError } = await supabase
              .storage
              .from('telegram-media')
              .remove([message.storage_path]);
              
            // Log but don't fail if delete fails
            if (deleteError) {
              console.error(`Failed to delete old file at ${message.storage_path}: ${deleteError.message}`);
            }
          } catch (error) {
            console.error('Error moving file:', error);
            // Continue with path update even if move fails
          }
        } else {
          // File doesn't exist at current path, mark for redownload
          result.needs_redownload = true;
        }
        
        // Update the message with the new storage path
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            storage_path: storagePath,
            storage_path_standardized: true,
            needs_redownload: result.needs_redownload || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
          
        if (updateError) {
          throw new Error(`Failed to update storage path: ${updateError.message}`);
        }
        
        result.success = true;
        result.original = message.storage_path;
        result.updated = storagePath;
        break;
      }
      
      case 'redownload': {
        if (!message.file_unique_id) {
          throw new Error('Message has no file_unique_id to redownload');
        }
        
        if (!message.media_group_id) {
          throw new Error('This message is not part of a media group. Use Telegram API redownload instead.');
        }
        
        // Find a valid file_id in the media group
        const { data: validFile, error: fileError } = await supabase.rpc(
          'xdelo_find_valid_file_id',
          {
            p_media_group_id: message.media_group_id,
            p_file_unique_id: message.file_unique_id
          }
        );
        
        if (fileError) {
          throw new Error(`Failed to find valid file_id: ${fileError.message}`);
        }
        
        if (!validFile) {
          throw new Error('No valid file_id found in media group');
        }
        
        console.log(`Found valid file_id for ${message.file_unique_id} in media group ${message.media_group_id}`);
        
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
        
        // Upload to Supabase Storage with proper options
        const uploadOptions = xdelo_getUploadOptions(message.mime_type);
        const { error: uploadError } = await supabase
          .storage
          .from('telegram-media')
          .upload(storagePath, fileData, uploadOptions);
        
        if (uploadError) {
          throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
        }
        
        // Update the message status
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            file_id: validFile,
            file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            needs_redownload: false,
            redownload_completed_at: new Date().toISOString(),
            storage_path: storagePath,
            error_message: null
          })
          .eq('id', message.id);
        
        if (updateError) {
          throw new Error(`Failed to update message: ${updateError.message}`);
        }
        
        result.success = true;
        result.storagePath = storagePath;
        break;
      }
      
      default:
        throw new Error(`Unknown repair type: ${repairType}`);
    }
    
    // Log success 
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: `file_${repairType}_repaired`,
        entity_id: message.id,
        correlation_id: correlationId,
        metadata: result
      });
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in file repair:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

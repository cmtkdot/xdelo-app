
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { 
  xdelo_validateAndFixStoragePath, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_downloadMediaFromTelegram
} from "../_shared/mediaUtils.ts";

// Declare types needed for the function
interface MediaRepairOptions {
  messageIds?: string[];
  limit?: number;
  checkStorageOnly?: boolean;
  fixContentTypes?: boolean;
  mediaGroupId?: string;
  storagePathOnly?: boolean;
  forceRedownload?: boolean;
}

interface RepairResult {
  success: boolean;
  results?: {
    processed: number;
    repaired: number;
    verified: number;
    failed: number;
    details: any[];
  };
  error?: string;
  message?: string;
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

/**
 * Verify file existence in storage and optionally check content-type
 */
async function verifyFile(
  message: any, 
  options: MediaRepairOptions = {}
): Promise<{ success: boolean; status: string; details?: any }> {
  if (!message || !message.storage_path) {
    return { success: false, status: 'invalid_data', details: { reason: 'Missing storage path' } };
  }
  
  try {
    // First, check if file exists in storage
    const { data, error } = await supabaseClient.storage
      .from('telegram-media')
      .createSignedUrl(message.storage_path, 60);
    
    if (error || !data) {
      return { 
        success: false, 
        status: 'missing_file',
        details: { 
          error: error?.message || 'File not found',
          storage_path: message.storage_path 
        }
      };
    }
    
    // File exists, check if repair is needed
    let needs_repair = false;
    let repair_reasons = [];
    let mime_type_fix = null;
    
    // Check if storage path uses a standardized format
    const expectedPath = xdelo_validateAndFixStoragePath(
      message.file_unique_id,
      message.mime_type || 'application/octet-stream'
    );
    
    if (message.storage_path !== expectedPath) {
      needs_repair = true;
      repair_reasons.push('non_standard_path');
    }
    
    // If checking content types
    if (options.fixContentTypes) {
      // Verify the MIME type is appropriate
      if (message.telegram_data) {
        const detected_mime_type = xdelo_detectMimeType(message.telegram_data);
        
        if (detected_mime_type !== message.mime_type && 
            detected_mime_type !== 'application/octet-stream') {
          needs_repair = true;
          repair_reasons.push('incorrect_mime_type');
          mime_type_fix = detected_mime_type;
        }
      }
    }
    
    // If repair needed but we're only checking, return the status
    if (needs_repair && options.checkStorageOnly) {
      return {
        success: true,
        status: 'needs_repair',
        details: {
          storage_path: message.storage_path,
          expected_path: expectedPath,
          current_mime_type: message.mime_type,
          detected_mime_type: mime_type_fix,
          repair_reasons
        }
      };
    }
    
    // If everything is good, we're done
    if (!needs_repair && !options.forceRedownload) {
      return {
        success: true,
        status: 'verified',
        details: {
          storage_path: message.storage_path,
          mime_type: message.mime_type
        }
      };
    }
    
    // Perform repairs if needed
    if (needs_repair || options.forceRedownload) {
      if (options.storagePathOnly && !options.forceRedownload) {
        // Fix storage path without redownloading
        const { data: fileData, error: fileError } = await supabaseClient.storage
          .from('telegram-media')
          .download(message.storage_path);
          
        if (fileError || !fileData) {
          return {
            success: false,
            status: 'download_failed',
            details: {
              error: fileError?.message || 'Failed to download existing file',
              storage_path: message.storage_path
            }
          };
        }
        
        // Upload to the new path
        const mimeType = mime_type_fix || message.mime_type || 'application/octet-stream';
        const uploadOptions = xdelo_getUploadOptions(mimeType);
        
        const { error: uploadError } = await supabaseClient.storage
          .from('telegram-media')
          .upload(expectedPath, fileData, uploadOptions);
          
        if (uploadError) {
          return {
            success: false,
            status: 'upload_failed',
            details: {
              error: uploadError.message,
              storage_path: expectedPath
            }
          };
        }
        
        // Update the message record
        const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${expectedPath}`;
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            storage_path: expectedPath,
            public_url: publicUrl,
            mime_type: mimeType,
            storage_path_standardized: true,
            storage_exists: true,
            needs_redownload: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
          
        if (updateError) {
          return {
            success: false,
            status: 'update_failed',
            details: {
              error: updateError.message,
              id: message.id
            }
          };
        }
        
        return {
          success: true,
          status: 'repaired',
          details: {
            old_path: message.storage_path,
            new_path: expectedPath,
            old_mime_type: message.mime_type,
            new_mime_type: mimeType,
            repair_reasons
          }
        };
      } else if (message.file_id && TELEGRAM_BOT_TOKEN) {
        // Full redownload from Telegram
        // Detect MIME type from original telegram data if available
        const detectedMimeType = message.telegram_data ? 
          xdelo_detectMimeType(message.telegram_data) : 
          (mime_type_fix || message.mime_type || 'application/octet-stream');
          
        // Download file from Telegram
        const downloadResult = await xdelo_downloadMediaFromTelegram(
          message.file_id, 
          message.file_unique_id,
          detectedMimeType,
          TELEGRAM_BOT_TOKEN
        );
        
        if (!downloadResult.success || !downloadResult.blob) {
          return {
            success: false,
            status: 'telegram_download_failed',
            details: {
              error: downloadResult.error,
              file_id: message.file_id
            }
          };
        }
        
        // Get final MIME type from download result or detection
        const finalMimeType = downloadResult.mimeType || detectedMimeType;
        const uploadOptions = xdelo_getUploadOptions(finalMimeType);
        
        // Generate the correct storage path based on final MIME type
        const storagePath = downloadResult.storagePath || 
          xdelo_validateAndFixStoragePath(message.file_unique_id, finalMimeType);
          
        // Upload to storage
        const { error: uploadError } = await supabaseClient.storage
          .from('telegram-media')
          .upload(storagePath, downloadResult.blob, uploadOptions);
          
        if (uploadError) {
          return {
            success: false,
            status: 'upload_failed',
            details: {
              error: uploadError.message,
              storage_path: storagePath
            }
          };
        }
        
        // Update the message record
        const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            storage_path: storagePath,
            public_url: publicUrl,
            mime_type: finalMimeType,
            storage_path_standardized: true,
            storage_exists: true,
            needs_redownload: false,
            redownload_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            file_size: downloadResult.blob.size || message.file_size
          })
          .eq('id', message.id);
          
        if (updateError) {
          return {
            success: false,
            status: 'update_failed',
            details: {
              error: updateError.message,
              id: message.id
            }
          };
        }
        
        return {
          success: true,
          status: 'redownloaded',
          details: {
            old_path: message.storage_path,
            new_path: storagePath,
            old_mime_type: message.mime_type,
            new_mime_type: finalMimeType,
            file_size: downloadResult.blob.size,
            repair_reasons: [...repair_reasons, 'force_redownload']
          }
        };
      } else {
        return {
          success: false,
          status: 'cannot_repair',
          details: {
            reason: 'Missing file_id or TELEGRAM_BOT_TOKEN',
            id: message.id
          }
        };
      }
    }
    
    // If we reached here, file exists and no repair needed
    return {
      success: true,
      status: 'verified',
      details: {
        storage_path: message.storage_path,
        mime_type: message.mime_type
      }
    };
  } catch (error) {
    console.error('Error verifying file:', error);
    return { 
      success: false, 
      status: 'verification_error',
      details: { 
        error: error.message,
        id: message.id,
        storage_path: message.storage_path 
      }
    };
  }
}

/**
 * Process messages for repair
 */
async function repairMedia(options: MediaRepairOptions): Promise<RepairResult> {
  const results = {
    processed: 0,
    repaired: 0,
    verified: 0,
    failed: 0,
    details: [] as any[]
  };
  
  try {
    // Determine which messages to process
    let query = supabaseClient.from('messages')
      .select('*')
      .eq('deleted_from_telegram', false);
    
    if (options.messageIds && options.messageIds.length > 0) {
      // Process specific message IDs
      query = query.in('id', options.messageIds);
    } else if (options.mediaGroupId) {
      // Process messages in a specific media group
      query = query.eq('media_group_id', options.mediaGroupId);
    } else {
      // Process a limited number of recent messages with potential issues
      query = query.or('storage_exists.is.null,storage_exists.eq.false,mime_type.eq.application/octet-stream')
                  .order('created_at', { ascending: false })
                  .limit(options.limit || 50);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
    
    if (!messages || messages.length === 0) {
      return {
        success: true,
        message: 'No messages found matching the criteria',
        results: {
          processed: 0,
          repaired: 0,
          verified: 0,
          failed: 0,
          details: []
        }
      };
    }
    
    console.log(`Found ${messages.length} messages to process`);
    
    // Process each message
    for (const message of messages) {
      results.processed++;
      
      // Check and repair file
      const repairResult = await verifyFile(message, options);
      results.details.push({
        id: message.id,
        telegram_message_id: message.telegram_message_id,
        file_unique_id: message.file_unique_id,
        ...repairResult
      });
      
      if (!repairResult.success) {
        results.failed++;
        continue;
      }
      
      if (repairResult.status === 'repaired' || repairResult.status === 'redownloaded') {
        results.repaired++;
      } else if (repairResult.status === 'verified') {
        results.verified++;
      } else if (repairResult.status === 'needs_repair' && options.checkStorageOnly) {
        // Mark as needing repair but don't count as failed
        results.failed++;
      }
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error in repairMedia:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

/**
 * Process the request
 */
async function processRequest(options: MediaRepairOptions): Promise<RepairResult> {
  try {
    // If only checking storage, simply run the check
    if (options.checkStorageOnly) {
      return await repairMedia({ 
        ...options, 
        checkStorageOnly: true 
      });
    }
    
    // Repair the media with full options
    return await repairMedia(options);
  } catch (error) {
    console.error('Error processing repair request:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Edge function handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageIds, limit, checkStorageOnly, mediaGroupId, fixContentTypes, storagePathOnly, forceRedownload } = 
      await req.json() as MediaRepairOptions;
    
    const options: MediaRepairOptions = {
      messageIds,
      limit: limit || 50,
      checkStorageOnly: !!checkStorageOnly,
      mediaGroupId,
      fixContentTypes: !!fixContentTypes,
      storagePathOnly: !!storagePathOnly,
      forceRedownload: !!forceRedownload
    };
    
    console.log('Processing repair request with options:', JSON.stringify(options));
    
    const result = await processRequest(options);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

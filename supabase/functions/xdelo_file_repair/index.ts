
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient as supabase } from "../_shared/supabase.ts";
import { xdelo_validateAndFixStoragePath } from "../_shared/mediaUtils.ts";

interface FileRepairRequest {
  action: 'fix_mime_types' | 'repair_storage_paths' | 'fix_invalid_file_ids' | 'repair_all';
  messageIds?: string[];
  limit?: number;
  options?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { action, messageIds, limit = 50, options = {} } = await req.json() as FileRepairRequest;
    const correlationId = crypto.randomUUID();
    
    console.log(`[${correlationId}] File repair request: action=${action}, messageCount=${messageIds?.length || 'unspecified'}`);
    
    let result;
    
    switch (action) {
      case 'fix_mime_types':
        result = await fixMimeTypes(messageIds, limit, correlationId);
        break;
      case 'repair_storage_paths':
        result = await repairStoragePaths(messageIds, limit, correlationId);
        break;
      case 'fix_invalid_file_ids':
        result = await fixInvalidFileIds(messageIds, limit, options.dryRun, correlationId);
        break;
      case 'repair_all':
        result = await repairAll(messageIds, limit, correlationId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        action,
        correlationId,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in file repair function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fix MIME types based on telegram data
async function fixMimeTypes(messageIds?: string[], limit: number = 50, correlationId?: string): Promise<any> {
  try {
    if (messageIds && messageIds.length > 0) {
      // Fix specific messages
      const results = [];
      
      for (const messageId of messageIds) {
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', messageId)
          .single();
          
        if (messageError) {
          results.push({
            messageId,
            success: false,
            error: messageError.message
          });
          continue;
        }
        
        // Skip if no telegram_data
        if (!message.telegram_data) {
          results.push({
            messageId,
            success: false,
            error: 'No telegram_data available'
          });
          continue;
        }
        
        // Detect MIME type from telegram data
        const mimeType = detectMimeType(message.telegram_data);
        
        // Only update if detected type is better
        if (mimeType !== 'application/octet-stream' && mimeType !== message.mime_type) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              mime_type: mimeType,
              mime_type_original: message.mime_type || 'unknown',
              mime_type_corrected: true,
              mime_type_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
            
          if (updateError) {
            results.push({
              messageId,
              success: false,
              error: updateError.message
            });
          } else {
            results.push({
              messageId,
              success: true,
              old_mime_type: message.mime_type,
              new_mime_type: mimeType
            });
          }
        } else {
          results.push({
            messageId,
            success: true,
            status: 'already_correct',
            mime_type: message.mime_type
          });
        }
      }
      
      return {
        processed: messageIds.length,
        updated: results.filter(r => r.success && r.old_mime_type !== r.new_mime_type).length,
        results
      };
    } else {
      // Use database function to fix a batch
      const { data, error } = await supabase.rpc(
        'xdelo_fix_mime_types',
        {
          p_limit: limit,
          p_only_octet_stream: true
        }
      );
      
      if (error) {
        throw new Error(`Failed to run fix_mime_types: ${error.message}`);
      }
      
      // Log to audit trail
      await supabase.from('unified_audit_logs').insert({
        event_type: 'fix_mime_types',
        correlation_id: correlationId,
        metadata: {
          updated_count: data?.length || 0,
          processed_limit: limit
        }
      });
      
      return {
        processed: limit,
        updated: data?.length || 0,
        results: data || []
      };
    }
  } catch (error) {
    console.error('Error in fixMimeTypes:', error);
    throw error;
  }
}

// Repair storage paths for messages
async function repairStoragePaths(messageIds?: string[], limit: number = 50, correlationId?: string): Promise<any> {
  try {
    // Use database function to fix paths
    const { data, error } = await supabase.rpc(
      'xdelo_fix_storage_paths',
      {
        p_limit: limit,
        p_only_check: false
      }
    );
    
    if (error) {
      throw new Error(`Failed to run xdelo_fix_storage_paths: ${error.message}`);
    }
    
    const results = {
      processed: data?.length || 0,
      fixed: 0,
      needs_redownload: 0
    };
    
    // Count fixed and redownload items
    if (data && data.length > 0) {
      for (const item of data) {
        if (item.fixed) results.fixed++;
        if (item.needs_redownload) results.needs_redownload++;
      }
    }
    
    // Log to audit trail
    await supabase.from('unified_audit_logs').insert({
      event_type: 'repair_storage_paths',
      correlation_id: correlationId,
      metadata: {
        processed: results.processed,
        fixed: results.fixed,
        needs_redownload: results.needs_redownload
      }
    });
    
    return {
      ...results,
      details: data
    };
  } catch (error) {
    console.error('Error in repairStoragePaths:', error);
    throw error;
  }
}

// Fix invalid file IDs
async function fixInvalidFileIds(messageIds?: string[], limit: number = 20, dryRun: boolean = false, correlationId?: string): Promise<any> {
  try {
    // If specific messageIds are provided, use those
    if (messageIds && messageIds.length > 0) {
      console.log(`Processing ${messageIds.length} specified messages`);
      
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!telegramBotToken) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN env variable');
      }
      
      const results = [];
      
      for (const messageId of messageIds) {
        try {
          const result = await retryDownload(messageId, telegramBotToken);
          results.push({
            messageId,
            ...result
          });
        } catch (error) {
          console.error(`Error processing message ${messageId}:`, error);
          results.push({
            messageId,
            success: false,
            error: error.message
          });
        }
      }
      
      // Log to audit trail
      await supabase.from('unified_audit_logs').insert({
        event_type: 'fix_invalid_file_ids',
        correlation_id: correlationId,
        metadata: {
          messages_processed: messageIds.length,
          success_count: results.filter(r => r.success).length,
          dry_run: dryRun
        }
      });
      
      return {
        processed: messageIds.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } else {
      // Find messages with errors
      console.log(`Finding messages with download errors, limit: ${limit}`);
      
      let query = supabase
        .from('messages')
        .select('id, file_id, file_unique_id, mime_type, error_code, error_message, redownload_attempts')
        .is('storage_exists', false)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      query = query.or('error_message.is.not.null,needs_redownload.eq.true');
      
      const { data: messagesToFix, error: queryError } = await query;
      
      if (queryError) {
        throw new Error(`Error querying messages: ${queryError.message}`);
      }
      
      if (!messagesToFix || messagesToFix.length === 0) {
        return {
          processed: 0,
          message: 'No messages found that need fixing',
          messagesToFix: []
        };
      }
      
      console.log(`Found ${messagesToFix.length} messages to fix`);
      
      if (dryRun) {
        return {
          processed: 0,
          success: true,
          message: 'Dry run completed',
          messagesToFix
        };
      }
      
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!telegramBotToken) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN env variable');
      }
      
      // Process each message
      const results = [];
      
      for (const message of messagesToFix) {
        try {
          const result = await retryDownload(message.id, telegramBotToken);
          results.push({
            messageId: message.id,
            success: result.success,
            message: result.message
          });
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
          results.push({
            messageId: message.id,
            success: false,
            message: error.message
          });
        }
      }
      
      // Log to audit trail
      await supabase.from('unified_audit_logs').insert({
        event_type: 'fix_invalid_file_ids',
        correlation_id: correlationId,
        metadata: {
          messages_processed: messagesToFix.length,
          success_count: results.filter(r => r.success).length,
          dry_run: dryRun
        }
      });
      
      return {
        processed: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.length - results.filter(r => r.success).length,
        results
      };
    }
  } catch (error) {
    console.error('Error in fixInvalidFileIds:', error);
    throw error;
  }
}

// Function to repair all aspects of messages
async function repairAll(messageIds?: string[], limit: number = 20, correlationId?: string): Promise<any> {
  try {
    // Start with MIME type fixes
    const mimeTypesResult = await fixMimeTypes(messageIds, limit, correlationId);
    
    // Then repair storage paths
    const storagePathsResult = await repairStoragePaths(messageIds, limit, correlationId);
    
    // Finally fix invalid file IDs
    const fileIdsResult = await fixInvalidFileIds(messageIds, limit, false, correlationId);
    
    // Log consolidated repair
    await supabase.from('unified_audit_logs').insert({
      event_type: 'repair_all',
      correlation_id: correlationId,
      metadata: {
        mime_types: {
          processed: mimeTypesResult.processed,
          updated: mimeTypesResult.updated
        },
        storage_paths: {
          processed: storagePathsResult.processed,
          fixed: storagePathsResult.fixed,
          needs_redownload: storagePathsResult.needs_redownload
        },
        file_ids: {
          processed: fileIdsResult.processed,
          succeeded: fileIdsResult.succeeded,
          failed: fileIdsResult.failed
        }
      }
    });
    
    return {
      mime_types: mimeTypesResult,
      storage_paths: storagePathsResult,
      file_ids: fileIdsResult
    };
  } catch (error) {
    console.error('Error in repairAll:', error);
    throw error;
  }
}

// Helper function to retry download for a message
async function retryDownload(messageId: string, telegramBotToken: string): Promise<{ success: boolean; message: string }> {
  try {
    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError) {
      throw new Error(`Failed to get message details: ${messageError.message}`);
    }
    
    if (!message.file_unique_id) {
      throw new Error('No file_unique_id available');
    }
    
    // First try using the existing file_id if available
    let file_id = message.file_id;
    
    // If no valid file_id, try to find one from the media group
    if (!file_id && message.media_group_id) {
      const { data: validFileId, error: fileError } = await supabase.rpc(
        'xdelo_find_valid_file_id',
        {
          p_media_group_id: message.media_group_id,
          p_file_unique_id: message.file_unique_id
        }
      );
      
      if (fileError) {
        throw new Error(`Failed to find valid file_id: ${fileError.message}`);
      }
      
      file_id = validFileId;
    }
    
    if (!file_id) {
      return { success: false, message: 'No valid file_id available' };
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${file_id}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    // Standardize storage path
    const storagePath = await xdelo_validateAndFixStoragePath(message.file_unique_id, message.mime_type);
    
    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();
    
    // Set upload options based on mime type
    const uploadOptions = getUploadOptions(message.mime_type);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, fileData, { ...uploadOptions, upsert: true });
      
    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    // Update message with new info
    const updateData = {
      file_id,
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      storage_path: storagePath,
      public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`,
      storage_exists: true,
      needs_redownload: false,
      redownload_reason: null,
      error_message: null,
      error_code: null,
      updated_at: new Date().toISOString(),
      redownload_attempts: (message.redownload_attempts || 0) + 1,
      redownloaded_at: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);
      
    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }
    
    return { 
      success: true, 
      message: `Successfully redownloaded file and saved to ${storagePath}` 
    };
  } catch (error) {
    console.error(`Error in retryDownload for message ${messageId}:`, error);
    
    // Update message with error
    await supabase
      .from('messages')
      .update({
        error_message: error.message,
        error_code: 'DOWNLOAD_RETRY_FAILED',
        updated_at: new Date().toISOString(),
        redownload_attempts: supabase.rpc('increment', { row_id: messageId, table_name: 'messages', column_name: 'redownload_attempts' })
      })
      .eq('id', messageId);
      
    return { success: false, message: error.message };
  }
}

// Helper function to detect MIME type from telegram data
function detectMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  if (telegramData.photo) return 'image/jpeg';
  
  if (telegramData.video) {
    return telegramData.video.mime_type || 'video/mp4';
  }
  
  if (telegramData.document) {
    return telegramData.document.mime_type || 'application/octet-stream';
  }
  
  if (telegramData.audio) {
    return telegramData.audio.mime_type || 'audio/mpeg';
  }
  
  if (telegramData.voice) {
    return telegramData.voice.mime_type || 'audio/ogg';
  }
  
  if (telegramData.animation) return 'video/mp4';
  
  if (telegramData.sticker) {
    return telegramData.sticker.is_animated ? 'application/x-tgsticker' : 'image/webp';
  }
  
  return 'application/octet-stream';
}

// Helper function to get upload options based on mime type
function getUploadOptions(mimeType: string): any {
  const options: Record<string, any> = {
    cacheControl: '3600',
  };
  
  // Set contentType based on mimeType
  if (mimeType) {
    options.contentType = mimeType;
  }
  
  // Set proper content disposition
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/gif' || 
      mimeType === 'image/webp' || mimeType.startsWith('video/')) {
    // For media files, encourage inline viewing
    options.contentDisposition = 'inline';
  } else {
    // For documents, encourage download
    options.contentDisposition = 'attachment';
  }
  
  return options;
}

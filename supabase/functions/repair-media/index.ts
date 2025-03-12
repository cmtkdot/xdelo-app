import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  xdelo_isViewableMimeType, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_repairContentDisposition,
  xdelo_recoverFileMetadata,
  xdelo_validateAndFixStoragePath
} from "../_shared/mediaUtils.ts";
import { supabaseClient as supabase } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { action, messageIds, options = {} } = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`Media repair request: action=${action}, messageCount=${messageIds?.length}, correlationId=${correlationId}`);
    
    // Action router
    switch (action) {
      case 'repair_all':
        return await repairMessages(messageIds, {
          fixContentDisposition: true,
          fixMimeTypes: true,
          repairStoragePaths: true,
          recoverMetadata: true,
          ...options
        }, correlationId);
      case 'fix_content_disposition':
        return await fixContentDisposition(messageIds, correlationId);
      case 'fix_mime_types':
        return await fixMissingMimeTypes(messageIds, correlationId);
      case 'repair_storage_paths':
        return await repairStoragePaths(messageIds, correlationId);
      case 'recover_metadata':
        return await recoverFileMetadata(messageIds, correlationId);
      case 'validate_messages':
        return await validateMessages(messageIds, correlationId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in repair-media function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

// Comprehensive repair operation that handles multiple repair types
async function repairMessages(messageIds, options, correlationId) {
  try {
    if (!messageIds || !messageIds.length) {
      throw new Error('No message IDs provided');
    }
    
    const results = {
      messageCount: messageIds.length,
      successful: 0,
      failed: 0,
      contentDispositionFixed: 0,
      mimeTypesFixed: 0,
      storagePathsRepaired: 0,
      metadataRecovered: 0,
      details: []
    };
    
    // Process messages sequentially to avoid rate limits
    for (const messageId of messageIds) {
      const messageResult = {
        messageId,
        repairs: {},
        success: true,
        error: null
      };
      
      try {
        // Get message details first
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', messageId)
          .single();
        
        if (messageError) throw messageError;
        
        // Step 1: Fix MIME Types if needed
        if (options.fixMimeTypes && (!message.mime_type || message.mime_type === 'application/octet-stream')) {
          const telegramData = message.telegram_data;
          const mediaObj = {
            photo: telegramData?.photo,
            video: telegramData?.video,
            document: telegramData?.document,
            audio: telegramData?.audio,
            voice: telegramData?.voice
          };
          
          const mimeType = xdelo_detectMimeType(mediaObj);
          
          if (mimeType !== 'application/octet-stream' || message.mime_type !== mimeType) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({ mime_type: mimeType })
              .eq('id', messageId);
              
            if (!updateError) {
              messageResult.repairs.mimeTypeFixed = true;
              results.mimeTypesFixed++;
            }
          }
        }
        
        // Step 2: Repair storage paths if needed
        if (options.repairStoragePaths) {
          const { data: storagePath, error: pathError } = await supabase.rpc(
            'xdelo_standardize_storage_path',
            {
              p_file_unique_id: message.file_unique_id,
              p_mime_type: message.mime_type || 'application/octet-stream'
            }
          );
          
          if (!pathError && storagePath !== message.storage_path) {
            // Update with new storage path - no public_url field
            await supabase
              .from('messages')
              .update({
                storage_path: storagePath
              })
              .eq('id', messageId);
              
            messageResult.repairs.storagePathRepaired = true;
            results.storagePathsRepaired++;
          }
        }
        
        // Step 3: Fix content disposition if needed
        if (options.fixContentDisposition && message.storage_path) {
          const fullPath = `telegram-media/${message.storage_path}`;
          const success = await xdelo_repairContentDisposition(fullPath);
          
          if (success) {
            messageResult.repairs.contentDispositionFixed = true;
            results.contentDispositionFixed++;
          }
        }
        
        // Step 4: Recover file metadata if needed
        if (options.recoverMetadata) {
          const metadataResult = await xdelo_recoverFileMetadata(messageId);
          
          if (metadataResult.success) {
            messageResult.repairs.metadataRecovered = true;
            results.metadataRecovered++;
          }
        }
        
        // Check if redownload is needed or requested
        if (options.redownloadMissing && (!message.storage_path || options.forceRedownload)) {
          // Try to redownload from media group if possible
          if (message.media_group_id) {
            const redownloadResult = await redownloadFromMediaGroup(message);
            
            if (redownloadResult.success) {
              messageResult.repairs.redownloaded = true;
            }
          }
        }
        
        results.successful++;
      } catch (error) {
        messageResult.success = false;
        messageResult.error = error.message;
        results.failed++;
      }
      
      results.details.push(messageResult);
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_repair_operation',
      correlation_id: correlationId,
      metadata: {
        action: 'repair_all',
        message_count: messageIds.length,
        results: {
          successful: results.successful,
          failed: results.failed,
          repairs: {
            contentDispositionFixed: results.contentDispositionFixed,
            mimeTypesFixed: results.mimeTypesFixed,
            storagePathsRepaired: results.storagePathsRepaired,
            metadataRecovered: results.metadataRecovered
          }
        }
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        correlationId,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in repairMessages:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Fix content disposition for specified messages - this functions specifically targets
// ensuring the right content disposition setting for browser viewing
async function fixContentDisposition(messageIds, correlationId) {
  try {
    let query = supabase.from('messages').select('id, storage_path, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, get the latest 100 files
      query = query.order('created_at', { ascending: false }).limit(100);
    }
    
    // Only process files with storage paths
    query = query.not('storage_path', 'is', null);
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const successful = [];
    const failed = [];
    
    // Process each message's file to ensure proper content disposition
    for (const message of messages) {
      try {
        if (message.storage_path) {
          const success = await xdelo_repairContentDisposition(`telegram-media/${message.storage_path}`);
          
          if (success) {
            successful.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: true
            });
          } else {
            failed.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: false,
              error: 'Failed to repair content disposition'
            });
          }
        } else {
          failed.push(message.id);
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            success: false,
            error: 'No storage path available'
          });
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failed.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: false,
          error: error.message
        });
      }
    }
    
    await supabase.from('unified_audit_logs').insert({
      event_type: 'fix_content_disposition',
      correlation_id: correlationId,
      metadata: {
        processed: messages.length,
        successful: successful.length,
        failed: failed.length
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          processed: messages.length,
          successful: successful.length,
          failed: failed.length,
          results
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fixContentDisposition:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Repair storage paths for specified messages
async function repairStoragePaths(messageIds, correlationId) {
  try {
    // Build query to find messages to repair
    let query = supabase
      .from('messages')
      .select('id, file_unique_id, mime_type, storage_path')
      .eq('deleted_from_telegram', false)
      .is('file_unique_id', 'not', null);
      
    // If specific message IDs provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise limit to recent messages
      query = query.order('created_at', { ascending: false }).limit(100);
    }
    
    const { data: messages, error: queryError } = await query;
    
    if (queryError) {
      throw new Error(`Failed to fetch messages: ${queryError.message}`);
    }
    
    console.log(`Found ${messages?.length || 0} messages to process`);
    
    let repairedCount = 0;
    const results = [];
    
    // Process each message
    for (const message of messages || []) {
      try {
        if (!message.file_unique_id) continue;
        
        // Get proper storage path
        const { data: storagePath, error: pathError } = await supabase.rpc(
          'xdelo_standardize_storage_path',
          {
            p_file_unique_id: message.file_unique_id,
            p_mime_type: message.mime_type || 'application/octet-stream'
          }
        );
        
        if (pathError) {
          console.error(`Error getting standardized path for ${message.id}:`, pathError);
          results.push({
            message_id: message.id,
            success: false,
            error: pathError.message
          });
          continue;
        }
        
        // Update storage path if needed
        if (storagePath !== message.storage_path) {
          const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
          
          await supabase
            .from('messages')
            .update({
              storage_path: storagePath,
              public_url: publicUrl
            })
            .eq('id', message.id);
            
          repairedCount++;
          results.push({
            message_id: message.id,
            success: true,
            old_path: message.storage_path,
            new_path: storagePath
          });
          console.log(`Updated storage path for message ${message.id}: ${message.storage_path} -> ${storagePath}`);
        } else {
          results.push({
            message_id: message.id,
            success: true,
            status: 'already_correct'
          });
        }
      } catch (messageError) {
        console.error(`Error processing message ${message.id}:`, messageError);
        results.push({
          message_id: message.id,
          success: false,
          error: messageError.message
        });
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'storage_paths_repaired',
      correlation_id: correlationId,
      metadata: {
        messages_processed: messages?.length || 0,
        repaired_count: repairedCount
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          processed: messages?.length || 0,
          repaired: repairedCount,
          results
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in repairStoragePaths:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Fix missing MIME types
async function fixMissingMimeTypes(messageIds, correlationId) {
  try {
    // Build query for messages with missing or default MIME types
    let query = supabase
      .from('messages')
      .select('id, telegram_data, mime_type, file_unique_id');
      
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.or('mime_type.is.null,mime_type.eq.application/octet-stream')
        .order('created_at', { ascending: false })
        .limit(100);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    let fixedCount = 0;
    
    for (const message of messages) {
      try {
        // Skip messages without telegram_data
        if (!message.telegram_data) {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'skipped',
            reason: 'no_telegram_data'
          });
          continue;
        }
        
        // Extract media components from telegram_data
        const telegramData = message.telegram_data;
        const mediaObj = {
          photo: telegramData.photo,
          video: telegramData.video,
          document: telegramData.document,
          audio: telegramData.audio,
          voice: telegramData.voice
        };
        
        // Detect MIME type
        const mimeType = xdelo_detectMimeType(mediaObj);
        
        // Skip if we couldn't detect a better MIME type
        if (mimeType === 'application/octet-stream' && message.mime_type === 'application/octet-stream') {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'skipped',
            reason: 'cannot_detect_better_mime_type'
          });
          continue;
        }
        
        // Update the message with the detected MIME type
        const { error: updateError } = await supabase
          .from('messages')
          .update({ mime_type: mimeType })
          .eq('id', message.id);
        
        if (updateError) {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'error',
            error: updateError.message
          });
        } else {
          fixedCount++;
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'updated',
            old_mime_type: message.mime_type,
            new_mime_type: mimeType
          });
        }
      } catch (processError) {
        console.error(`Error processing message ${message.id}:`, processError);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'error',
          error: processError.message
        });
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'mime_types_fixed',
      correlation_id: correlationId,
      metadata: {
        messages_processed: messages.length,
        fixed_count: fixedCount
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        fixed: fixedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fixMissingMimeTypes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Recover file metadata for specific messages
async function recoverFileMetadata(messageIds, correlationId) {
  try {
    if (!messageIds || messageIds.length === 0) {
      throw new Error('No message IDs provided');
    }
    
    const results = [];
    let recoveredCount = 0;
    
    for (const messageId of messageIds) {
      const result = await xdelo_recoverFileMetadata(messageId);
      
      if (result.success) recoveredCount++;
      
      results.push({
        message_id: messageId,
        ...result
      });
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'file_metadata_recovered',
      correlation_id: correlationId,
      metadata: {
        messages_processed: messageIds.length,
        recovered_count: recoveredCount
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messageIds.length,
        recovered: recoveredCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recoverFileMetadata:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Validate media files exist in storage
async function validateMessages(messageIds, correlationId) {
  try {
    let query = supabase.from('messages').select('id, storage_path, public_url, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise get a reasonable batch
      query = query.order('created_at', { ascending: false }).limit(50);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const issues = [];
    
    for (const message of messages) {
      // Skip messages without storage path
      if (!message.storage_path) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'missing_storage_path'
        });
        issues.push(message.id);
        continue;
      }
      
      // Check if the file exists in storage
      const exists = await supabase.storage
        .from('telegram-media')
        .createSignedUrl(message.storage_path, 60)
        .then(({ data, error }) => {
          return !error && !!data;
        })
        .catch(() => false);
      
      if (!exists) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'file_not_found',
          storage_path: message.storage_path
        });
        issues.push(message.id);
      } else {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'file_exists',
          storage_path: message.storage_path
        });
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_files_validated',
      correlation_id: correlationId,
      metadata: {
        messages_processed: messages.length,
        issues_found: issues.length
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        total: messages.length,
        issues: issues.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validateMediaFiles:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Helper function to redownload from media group
async function redownloadFromMediaGroup(message) {
  try {
    if (!message.media_group_id) {
      return { success: false, error: 'No media group ID available' };
    }
    
    // Find a valid file_id in the media group
    const { data: validFileId, error: fileError } = await supabase.rpc(
      'xdelo_find_valid_file_id',
      {
        p_media_group_id: message.media_group_id,
        p_file_unique_id: message.file_unique_id
      }
    );
    
    if (fileError || !validFileId) {
      return { success: false, error: fileError?.message || 'No valid file_id found' };
    }
    
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken) {
      return { success: false, error: 'Telegram bot token not available' };
    }
    
    // Get file path from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${validFileId}`
    );
    
    if (!fileInfoResponse.ok) {
      return { success: false, error: `Failed to get file info: ${await fileInfoResponse.text()}` };
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      return { success: false, error: `Telegram API error: ${JSON.stringify(fileInfo)}` };
    }
    
    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      return { success: false, error: `Failed to download file: ${await fileDataResponse.text()}` };
    }
    
    const fileData = await fileDataResponse.blob();
    
    // Get proper storage path
    const { data: storagePath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type || 'application/octet-stream'
      }
    );
    
    if (pathError) {
      return { success: false, error: `Failed to get standardized path: ${pathError.message}` };
    }
    
    // Upload to Supabase Storage with proper options and content disposition
    const uploadOptions = xdelo_getUploadOptions(message.mime_type);
    
    const { error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, fileData, { ...uploadOptions, upsert: true });
    
    if (uploadError) {
      return { success: false, error: `Failed to upload media: ${uploadError.message}` };
    }
    
    // Update the message - remove public_url field
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: validFileId,
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        storage_path: storagePath,
        error_message: null
      })
      .eq('id', message.id);
    
    if (updateError) {
      return { success: false, error: `Failed to update message: ${updateError.message}` };
    }
    
    return { success: true, message_id: message.id, storage_path: storagePath };
  } catch (error) {
    console.error('Error in redownloadFromMediaGroup:', error);
    return { success: false, error: error.message };
  }
}

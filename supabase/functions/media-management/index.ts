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

interface RequestBody {
  action: 'redownload' | 'validate' | 'repair-storage-paths' | 'repair-media-groups' | 'repair-processing-flow';
  messageIds?: string[];
  mediaGroupId?: string;
  limit?: number;
  options?: {
    onlyNewest?: boolean;
    repairEnums?: boolean;
    resetAll?: boolean;
    forceResetStalled?: boolean;
    fullRepair?: boolean;
    sourceMessageId?: string;
  };
}

/**
 * Media Management System - Unified handler for media file operations
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const correlationId = crypto.randomUUID();
    const body = await req.json() as RequestBody;
    const { action, messageIds = [], mediaGroupId, limit = 20, options = {} } = body;
    
    console.log(`Media management operation: ${action}, correlation ID: ${correlationId}`);
    
    let result;
    
    switch (action) {
      case 'redownload':
        result = await handleRedownload(messageIds, mediaGroupId, correlationId);
        break;
      case 'validate':
        result = await validateStorageFiles(limit, options.onlyNewest || true);
        break;
      case 'repair-storage-paths':
        result = await repairStoragePaths(messageIds);
        break;
      case 'repair-media-groups':
        result = await repairMediaGroups(mediaGroupId, options.sourceMessageId, options.fullRepair || false, correlationId);
        break;
      case 'repair-processing-flow':
        result = await repairProcessingFlow(limit, options, correlationId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_management_operation',
      correlation_id: correlationId,
      metadata: {
        action,
        result_summary: {
          success: true,
          operation_type: action,
          affected_items: result?.processed || result?.repaired || 0
        },
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        data: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in media management operation:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Redownload media files for specified messages
 */
async function handleRedownload(messageIds: string[], mediaGroupId?: string, correlationId?: string): Promise<any> {
  // If specific message ID is provided with a media group ID, use media group-based redownload
  if (messageIds.length === 1 && mediaGroupId) {
    return redownloadFromMediaGroup(messageIds[0], mediaGroupId, correlationId);
  }
  
  // Otherwise use the general redownload function
  let query = supabase
    .from('messages')
    .select('*');
  
  // If specific message IDs were provided, use them
  if (messageIds && messageIds.length > 0) {
    query = query.in('id', messageIds);
  } else {
    // Otherwise get messages flagged for redownload
    query = query.eq('needs_redownload', true).limit(50);
  }
  
  const { data: messages, error } = await query;
  
  if (error) throw error;
  
  const results = [];
  const successful = [];
  const failed = [];
  
  // Process each message sequentially
  for (const message of messages) {
    try {
      // Try media group redownload first if applicable
      if (message.media_group_id) {
        try {
          const result = await redownloadFromMediaGroup(message.id, message.media_group_id, correlationId);
          successful.push(message.id);
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            success: true,
            method: 'media_group'
          });
          continue;
        } catch (groupError) {
          console.warn(`Media group download failed for ${message.id}, trying direct: ${groupError.message}`);
          // Continue to direct download
        }
      }
      
      // If media group redownload failed or not applicable, try direct download
      const result = await downloadFromTelegram(message);
      successful.push(message.id);
      results.push({
        message_id: message.id,
        file_unique_id: message.file_unique_id,
        success: true,
        method: 'telegram_api'
      });
    } catch (error) {
      console.error(`Error redownloading file for message ${message.id}:`, error);
      
      // Update message with error information
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          redownload_attempts: (message.redownload_attempts || 0) + 1,
          error_message: error.message,
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      failed.push(message.id);
      results.push({
        message_id: message.id,
        file_unique_id: message.file_unique_id,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    processed: messages.length,
    successful: successful.length,
    failed: failed.length,
    results
  };
}

/**
 * Redownload a file using another message from the same media group
 */
async function redownloadFromMediaGroup(messageId: string, mediaGroupId: string, correlationId?: string): Promise<any> {
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

  // Find a valid file_id in the media group
  const { data: validFile, error: fileError } = await supabase.rpc(
    'xdelo_find_valid_file_id',
    {
      p_media_group_id: mediaGroupId,
      p_file_unique_id: message.file_unique_id
    }
  );

  if (fileError) {
    throw new Error(`Failed to find valid file_id: ${fileError.message}`);
  }

  if (!validFile) {
    throw new Error('No valid file_id found in media group');
  }

  console.log(`Found valid file_id for ${message.file_unique_id} in media group ${mediaGroupId}`);

  // Get file path from Telegram
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    throw new Error('Telegram bot token not found in environment variables');
  }

  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${validFile}`
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
    `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
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
      correlation_id: correlationId || crypto.randomUUID(),
      metadata: {
        media_group_id: mediaGroupId,
        file_unique_id: message.file_unique_id,
        storage_path: storagePath,
        source: 'media_group'
      }
    });

  return {
    success: true,
    messageId,
    fileUniqueId: message.file_unique_id,
    storagePath
  };
}

/**
 * Download directly from Telegram API using bot token
 */
async function downloadFromTelegram(message: any): Promise<any> {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('Telegram bot token not found in environment variables');
    }

    // First try to use original file_id if available and not expired
    let fileId = message.original_file_id || message.file_id;
    
    // Check if file_id is likely expired
    const fileIdExpired = message.file_id_expires_at && 
                          new Date(message.file_id_expires_at) < new Date();
    
    if (fileIdExpired || !fileId) {
      throw new Error('No valid file_id available for direct download');
    }
    
    // Get file path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
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
    
    // Determine the correct storage path
    const mimeType = message.mime_type || 'image/jpeg';
    const extension = mimeType.split('/')[1];
    const storagePath = `${message.file_unique_id}.${extension}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileBlob, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicURLData } = supabase.storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    const publicURL = publicURLData.publicUrl;

    // Update message record
    await supabase
      .from('messages')
      .update({
        public_url: publicURL,
        storage_path: storagePath,
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        file_id: fileId,
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        error_message: null
      })
      .eq('id', message.id);

    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: storagePath,
      public_url: publicURL
    };
  } catch (error) {
    console.error('Error downloading from Telegram:', error);
    throw error;
  }
}

/**
 * Validate storage files and flag missing ones for redownload
 */
async function validateStorageFiles(limit = 100, onlyNewest = true): Promise<any> {
  // Get messages to validate
  let query = supabase
    .from('messages')
    .select('id, file_unique_id, storage_path, mime_type, public_url')
    .not('file_unique_id', 'is', null);
  
  if (onlyNewest) {
    query = query.order('created_at', { ascending: false });
  }
  
  const { data: messages, error } = await query.limit(limit);
  
  if (error) throw new Error(`Database query error: ${error.message}`);
  
  const results = {
    processed: 0,
    valid: 0,
    invalid: 0,
    repaired: 0,
    details: []
  };
  
  // Validate each message's storage file
  for (const message of messages) {
    results.processed++;
    
    // Skip messages without storage path or file_unique_id
    if (!message.storage_path || !message.file_unique_id) {
      // Repair missing storage path
      const extension = message.mime_type ? message.mime_type.split('/')[1] : 'jpeg';
      const newStoragePath = `${message.file_unique_id}.${extension}`;
      
      // Update the message with the correct path
      const { error } = await supabase
        .from('messages')
        .update({
          storage_path: newStoragePath,
          needs_redownload: true,
          redownload_reason: 'Missing storage path',
          redownload_flagged_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      if (error) {
        console.error(`Error repairing message ${message.id}:`, error);
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'repair_failed',
          error: error.message
        });
      } else {
        results.repaired++;
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          old_path: message.storage_path,
          new_path: newStoragePath,
          status: 'repaired'
        });
      }
      continue;
    }
    
    // Check if file exists in storage
    try {
      const { data, error } = await supabase
        .storage
        .from('telegram-media')
        .download(message.storage_path);
      
      const fileExists = (data != null && !error);
      
      // Update validation status
      await supabase
        .from('storage_validations')
        .upsert({
          file_unique_id: message.file_unique_id,
          storage_path: message.storage_path,
          last_checked_at: new Date().toISOString(),
          is_valid: fileExists,
          error_message: fileExists ? null : 'File not found in storage'
        }, { onConflict: 'file_unique_id' });
      
      if (fileExists) {
        results.valid++;
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'valid'
        });
      } else {
        results.invalid++;
        
        // Flag for redownload
        const { error } = await supabase
          .from('messages')
          .update({
            needs_redownload: true,
            redownload_reason: 'File not found in storage',
            redownload_flagged_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'invalid',
          flagged_for_redownload: !error
        });
      }
    } catch (error) {
      console.error(`Error checking file for message ${message.id}:`, error);
      results.details.push({
        message_id: message.id,
        file_unique_id: message.file_unique_id,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Repair incorrect storage paths
 */
async function repairStoragePaths(specificMessageIds?: string[]): Promise<any> {
  try {
    console.log(`Repairing storage paths for ${specificMessageIds ? specificMessageIds.length : 'all'} messages`);
    
    // Call the database function to repair storage paths
    const { data, error } = await supabase.rpc('xdelo_repair_storage_paths');
    
    if (error) throw error;
    
    // If specific message IDs were provided, also update them directly
    if (specificMessageIds && specificMessageIds.length > 0) {
      const { data: messages, error: queryError } = await supabase
        .from('messages')
        .select('id, file_unique_id, mime_type, storage_path')
        .in('id', specificMessageIds);
      
      if (queryError) throw queryError;
      
      for (const message of messages || []) {
        // Generate correct storage path
        const extension = message.mime_type ? message.mime_type.split('/')[1] : 'jpeg';
        const correctPath = `${message.file_unique_id}.${extension}`;
        
        // Update if different
        if (message.storage_path !== correctPath) {
          await supabase
            .from('messages')
            .update({
              storage_path: correctPath,
              needs_redownload: true,
              redownload_reason: 'Manual storage path repair',
              redownload_flagged_at: new Date().toISOString()
            })
            .eq('id', message.id);
        }
      }
    }
    
    return {
      success: true,
      repaired: data?.length || 0,
      details: data
    };
  } catch (error) {
    console.error('Error repairing storage paths:', error);
    throw error;
  }
}

/**
 * Repair media groups
 */
async function repairMediaGroups(
  groupId?: string, 
  messageId?: string, 
  fullRepair = false,
  correlationId = crypto.randomUUID()
): Promise<any> {
  try {
    let repairResult;
    let fixedCount = 0;
    
    // Handle different types of repairs
    if (fullRepair) {
      // Full repair of all media groups
      console.log('Starting full repair of all media groups...');
      
      // 1. Find and fix groups with mixed processing states
      const { data: mixedStateGroups } = await supabase.rpc('xdelo_find_broken_media_groups');
      
      // 2. Process each broken group
      if (mixedStateGroups && mixedStateGroups.length > 0) {
        for (const group of mixedStateGroups) {
          if (group.media_group_id && group.source_message_id) {
            console.log(`Repairing group ${group.media_group_id} using source message ${group.source_message_id}`);
            
            try {
              const { data: syncResult } = await supabase.rpc(
                'xdelo_sync_media_group_content',
                {
                  p_source_message_id: group.source_message_id,
                  p_media_group_id: group.media_group_id,
                  p_correlation_id: correlationId,
                  p_force_sync: true,
                  p_sync_edit_history: true
                }
              );
              
              if (syncResult && syncResult.success) {
                fixedCount++;
              }
            } catch (syncError) {
              console.error(`Error repairing group ${group.media_group_id}:`, syncError.message);
            }
          }
        }
      }
      
      repairResult = { fixed_count: fixedCount, repair_type: 'full' };
    } 
    else if (groupId) {
      // Repair a specific media group
      if (!messageId) {
        // Find the best source message
        const { data: sourceMessage } = await supabase.rpc('xdelo_find_caption_message', { p_media_group_id: groupId });
        
        if (sourceMessage) {
          messageId = sourceMessage;
        } else {
          throw new Error(`No suitable source message found for group ${groupId}`);
        }
      }
      
      console.log(`Repairing specific group ${groupId} using message ${messageId}`);
      
      const { data: syncResult } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_source_message_id: messageId,
          p_media_group_id: groupId,
          p_correlation_id: correlationId,
          p_force_sync: true,
          p_sync_edit_history: true
        }
      );
      
      repairResult = syncResult;
      fixedCount = syncResult?.updated_count || 0;
    }
    else {
      // Standard repair - use the database repair function
      console.log('Running standard repair using xdelo_repair_media_group_syncs...');
      
      const { data: dbRepairResult } = await supabase.rpc('xdelo_repair_media_group_syncs');
      
      repairResult = { 
        repair_results: dbRepairResult,
        repair_type: 'standard'
      };
      
      fixedCount = dbRepairResult?.length || 0;
    }
    
    // Log the repair operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_repair_completed',
      correlation_id: correlationId,
      metadata: {
        repair_type: fullRepair ? 'full' : (groupId ? 'specific' : 'standard'),
        fixed_count: fixedCount,
        group_id: groupId || 'all',
        source_message_id: messageId
      },
      event_timestamp: new Date().toISOString()
    });

    return {
      success: true,
      fixed_count: fixedCount,
      repair_type: fullRepair ? 'full' : (groupId ? 'specific' : 'standard'),
      repair_result: repairResult,
      correlation_id: correlationId
    };
  } catch (error) {
    console.error(`Error in media group repair: ${error.message}`);
    throw error;
  }
}

/**
 * Repair processing flow issues
 */
async function repairProcessingFlow(
  limit: number, 
  options: any = {}, 
  correlationId: string
): Promise<any> {
  const { repairEnums = true, resetAll = false, forceResetStalled = false } = options;
  
  console.log(`Starting to repair processing flow, correlation ID: ${correlationId}`);
  
  // Track operations and results
  const operations = [];
  const results = {
    stuck_reset: 0,
    initialized_processed: 0,
    media_groups_fixed: 0,
    enum_repair: null,
    diagnostics: null
  };
  
  // 1. First check if we need to repair enum values
  if (repairEnums) {
    try {
      operations.push('Repairing enum values');
      // Try to add missing enum values first
      await supabase.rpc('xdelo_ensure_event_types_exist');
      console.log('Enum values checked/repaired');
      results.enum_repair = { success: true };
    } catch (enumError) {
      console.warn('Could not repair enums, proceeding with message repair only:', enumError);
      results.enum_repair = { success: false, error: enumError.message };
    }
  }
  
  // 2. Diagnostics to track the before state
  try {
    operations.push('Running diagnostics');
    const { data: beforeStats } = await supabase.rpc('xdelo_get_message_processing_stats');
    results.diagnostics = { before: beforeStats };
  } catch (diagError) {
    console.warn('Could not get message processing stats:', diagError);
  }
  
  // 3. If reset_all is true or force_reset_stalled is true, use the function to reset stuck messages
  if (resetAll || forceResetStalled) {
    try {
      operations.push('Resetting all stuck messages');
      const resetFunction = forceResetStalled 
        ? 'xdelo_reset_stalled_messages' 
        : 'xdelo_reset_all_stuck_messages';
      
      const { data: resetData, error: resetError } = await supabase.rpc(resetFunction);
      
      if (resetError) {
        throw new Error(`Error resetting stuck messages: ${resetError.message}`);
      }
      
      results.stuck_reset = resetData?.length || 0;
      console.log(`Reset ${results.stuck_reset} stuck messages`);
      
      // Also repair orphaned media group messages
      operations.push('Repairing orphaned media groups');
      const { data: orphanedData, error: orphanedError } = await supabase.rpc('xdelo_repair_orphaned_media_group_messages');
      
      if (orphanedError) {
        console.warn(`Warning: Could not repair orphaned media group messages: ${orphanedError.message}`);
      } else {
        results.media_groups_fixed = orphanedData?.length || 0;
        console.log(`Fixed ${results.media_groups_fixed} orphaned media groups`);
      }
    } catch (resetAllError) {
      console.error('Error in batch reset operation:', resetAllError);
      throw resetAllError;
    }
  } else {
    // 4. Otherwise, find and process specific stuck messages
    operations.push('Processing specific stuck messages');
    
    // Find messages stuck in 'processing' state
    const { data: stuckMessages, error: stuckError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id, correlation_id, processing_started_at')
      .eq('processing_state', 'processing')
      .is('analyzed_content', null)
      .order('processing_started_at', { ascending: true })
      .limit(limit);
    
    if (stuckError) {
      throw new Error(`Error finding stuck messages: ${stuckError.message}`);
    }
    
    // Find initialized messages with captions
    const { data: initializedMessages, error: initializedError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id, correlation_id')
      .eq('processing_state', 'initialized')
      .not('caption', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (initializedError) {
      throw new Error(`Error finding initialized messages: ${initializedError.message}`);
    }
    
    // Process stuck messages
    if (stuckMessages && stuckMessages.length > 0) {
      for (const message of stuckMessages) {
        await resetAndProcessMessage(message.id, message.caption, message.media_group_id, correlationId);
        results.stuck_reset++;
      }
    }
    
    // Process initialized messages
    if (initializedMessages && initializedMessages.length > 0) {
      for (const message of initializedMessages) {
        if (message.caption) {
          await processInitializedMessage(message.id, message.caption, message.media_group_id, correlationId);
          results.initialized_processed++;
        }
      }
    }
  }
  
  // 5. Final diagnostic after repairs
  try {
    operations.push('Running post-repair diagnostics');
    const { data: afterStats } = await supabase.rpc('xdelo_get_message_processing_stats');
    if (results.diagnostics) {
      results.diagnostics.after = afterStats;
    } else {
      results.diagnostics = { after: afterStats };
    }
  } catch (diagError) {
    console.warn('Could not get post-repair message processing stats:', diagError);
  }
  
  return {
    success: true,
    operations,
    results
  };
}

/**
 * Reset a message to pending state and then process it
 */
async function resetAndProcessMessage(
  messageId: string, 
  caption: string | null, 
  mediaGroupId: string | null,
  correlationId: string
) {
  try {
    // First reset the message to pending state
    const { error: resetError } = await supabase
      .from('messages')
      .update({
        processing_state: 'pending',
        processing_started_at: null,
        error_message: 'Reset from stuck processing state during repair',
        retry_count: supabase.rpc('increment', { row_id: messageId, table: 'messages', column: 'retry_count' }),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (resetError) {
      throw new Error(`Error resetting message ${messageId}: ${resetError.message}`);
    }
    
    // If caption exists, process it directly
    if (caption) {
      await directlyProcessMessage(messageId, caption, mediaGroupId, correlationId);
    }
    
    return true;
  } catch (error) {
    console.error(`Error resetting message ${messageId}:`, error);
    return false;
  }
}

/**
 * Process a message that's already in initialized state
 */
async function processInitializedMessage(
  messageId: string,
  caption: string | null,
  mediaGroupId: string | null,
  correlationId: string
) {
  try {
    // Update to pending state first
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message ${messageId}: ${updateError.message}`);
    }
    
    if (caption) {
      await directlyProcessMessage(messageId, caption, mediaGroupId, correlationId);
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing initialized message ${messageId}:`, error);

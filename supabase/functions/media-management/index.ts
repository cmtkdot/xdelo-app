import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Central handler for all media management operations
const handleMediaManagement = async (req: Request, correlationId: string) => {
  const body = await req.json();
  const { action, messageIds, mediaGroupId, limit = 20, options = {} } = body;
  
  console.log(`Media management operation: ${action}, correlation ID: ${correlationId}`);
  
  try {
    // Handle different operation types
    switch (action) {
      case 'repair-processing-flow':
        return await repairProcessingFlow(limit, options, correlationId);
        
      case 'repair-media-groups':
        return await repairMediaGroups(mediaGroupId, messageIds, options, correlationId);
        
      case 'redownload':
        return await redownloadMediaFiles(messageIds, mediaGroupId, correlationId);
        
      case 'validate':
        return await validateStorageFiles(limit, options, correlationId);
        
      case 'repair-storage-paths':
        return await repairStoragePaths(messageIds, correlationId);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error in media management (${action}):`, error);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_management_error',
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        action,
        options,
        mediaGroupId,
        message_ids_count: messageIds?.length
      },
      event_timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};

// Repair the message processing system and reset stuck messages
async function repairProcessingFlow(limit: number, options: any, correlationId: string) {
  const {
    repairEnums = true,
    resetAll = false,
    forceResetStalled = true
  } = options;
  
  console.log(`Repairing processing flow with options:`, { limit, repairEnums, resetAll, forceResetStalled });
  
  // Step 1: Repair enum values if needed
  if (repairEnums) {
    try {
      await supabase.rpc('xdelo_ensure_event_types_exist');
      console.log('Enum values checked/repaired');
    } catch (enumError) {
      console.warn('Could not repair enums, continuing with other repairs:', enumError);
    }
  }
  
  // Step 2: Fix processing state issues
  const { data: stateFixData, error: stateFixError } = await supabase.rpc(
    'xdelo_repair_message_processing_states',
    {
      p_reset_all: resetAll,
      p_correlation_id: correlationId,
      p_limit: limit,
      p_reset_stalled: forceResetStalled
    }
  );
  
  if (stateFixError) {
    throw new Error(`Failed to repair message states: ${stateFixError.message}`);
  }
  
  // Step 3: Fix media group syncing issues
  const { data: groupFixData, error: groupFixError } = await supabase.rpc(
    'xdelo_repair_media_group_syncs'
  );
  
  // Log the repair event
  await supabase.from('unified_audit_logs').insert({
    event_type: 'processing_flow_repaired',
    correlation_id: correlationId,
    metadata: {
      state_fix_results: stateFixData,
      group_fix_results: groupFixError ? { error: groupFixError.message } : groupFixData,
      repair_options: { repairEnums, resetAll, forceResetStalled, limit }
    },
    event_timestamp: new Date().toISOString()
  });
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        reset_count: stateFixData?.reset_count || 0,
        media_groups_fixed: groupFixData?.length || 0,
        correlation_id: correlationId
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Repair media groups by syncing content between related messages
async function repairMediaGroups(mediaGroupId?: string, messageIds?: string[], options: any = {}, correlationId: string) {
  const {
    fullRepair = false,
    sourceMessageId
  } = options;
  
  // Specific media group repair
  if (mediaGroupId) {
    console.log(`Repairing specific media group: ${mediaGroupId}`);
    
    // If no source message specified, find best candidate message with caption
    let sourceMsgId = sourceMessageId;
    
    if (!sourceMsgId) {
      // Find a suitable caption message
      const { data: sourceMessage } = await supabase.rpc(
        'xdelo_find_caption_message',
        { p_media_group_id: mediaGroupId }
      );
      
      sourceMsgId = sourceMessage;
      
      if (!sourceMsgId) {
        throw new Error(`No suitable caption message found for media group ${mediaGroupId}`);
      }
    }
    
    // Call the sync function directly
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      'xdelo_sync_media_group',
      {
        body: {
          mediaGroupId,
          sourceMessageId: sourceMsgId,
          correlationId,
          forceSync: true,
          syncEditHistory: true
        }
      }
    );
    
    if (syncError) {
      throw new Error(`Failed to sync media group: ${syncError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fixed_count: 1,
          media_group_id: mediaGroupId,
          source_message_id: sourceMsgId,
          sync_result: syncResult
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Bulk repair for all media groups with issues
  if (fullRepair) {
    console.log('Running full repair for all media groups with issues');
    
    const { data: bulkRepairResult, error: bulkRepairError } = await supabase.rpc(
      'xdelo_repair_media_group_syncs'
    );
    
    if (bulkRepairError) {
      throw new Error(`Failed to repair media groups: ${bulkRepairError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fixed_count: bulkRepairResult?.length || 0,
          groups: bulkRepairResult
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        fixed_count: 0,
        message: "No repair operation specified"
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Redownload media files for specified messages
async function redownloadMediaFiles(messageIds?: string[], mediaGroupId?: string, correlationId: string) {
  // If media group ID provided, get all messages in the group
  if (mediaGroupId && (!messageIds || messageIds.length === 0)) {
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('id')
      .eq('media_group_id', mediaGroupId)
      .eq('deleted_from_telegram', false);
      
    if (groupError) {
      throw new Error(`Failed to fetch media group messages: ${groupError.message}`);
    }
    
    messageIds = groupMessages?.map(m => m.id) || [];
    
    if (messageIds.length === 0) {
      throw new Error(`No messages found for media group ${mediaGroupId}`);
    }
  }
  
  if (!messageIds || messageIds.length === 0) {
    throw new Error("No message IDs provided for redownload");
  }
  
  // Mark messages for redownload
  const { data: updateResult, error: updateError } = await supabase
    .from('messages')
    .update({
      needs_redownload: true,
      redownload_flagged_at: new Date().toISOString(),
      redownload_reason: 'manual_request',
      processing_state: 'pending'
    })
    .in('id', messageIds)
    .select('id, file_unique_id');
    
  if (updateError) {
    throw new Error(`Failed to mark messages for redownload: ${updateError.message}`);
  }
  
  // Log the redownload request
  await supabase.from('unified_audit_logs').insert({
    event_type: 'redownload_requested',
    correlation_id: correlationId,
    metadata: {
      message_ids: messageIds,
      media_group_id: mediaGroupId,
      flagged_count: updateResult?.length || 0
    },
    event_timestamp: new Date().toISOString()
  });
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        flagged_count: updateResult?.length || 0,
        successful: updateResult?.length || 0,
        message_ids: updateResult?.map(m => m.id) || []
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Validate storage files for messages
async function validateStorageFiles(limit: number, options: any, correlationId: string) {
  const {
    onlyNewest = true,
    repair = false
  } = options;
  
  console.log(`Validating storage files with options:`, { limit, onlyNewest, repair });
  
  // Query messages to validate
  const query = supabase
    .from('messages')
    .select('id, file_unique_id, public_url, storage_path')
    .eq('deleted_from_telegram', false)
    .is('public_url', 'not', null)
    .limit(limit);
    
  if (onlyNewest) {
    query.order('created_at', { ascending: false });
  }
  
  const { data: messages, error: queryError } = await query;
  
  if (queryError) {
    throw new Error(`Failed to fetch messages for validation: ${queryError.message}`);
  }
  
  let invalidCount = 0;
  let repairedCount = 0;
  
  // Validate each file
  for (const message of messages || []) {
    try {
      // Skip messages without storage path
      if (!message.storage_path) continue;
      
      // Check if file exists in storage
      const { data: fileExists, error: fileError } = await supabase
        .storage
        .from('telegram-media')
        .createSignedUrl(message.storage_path, 60);
        
      // File is invalid if we can't get a signed URL
      const isValid = !fileError && fileExists;
      
      // Record validation result
      await supabase.from('storage_validations').insert({
        file_unique_id: message.file_unique_id,
        storage_path: message.storage_path,
        is_valid: isValid,
        error_message: fileError?.message,
        last_checked_at: new Date().toISOString()
      });
      
      // If invalid and repair requested, mark for redownload
      if (!isValid && repair) {
        await supabase
          .from('messages')
          .update({
            needs_redownload: true,
            redownload_flagged_at: new Date().toISOString(),
            redownload_reason: 'storage_validation_failed'
          })
          .eq('id', message.id);
          
        repairedCount++;
      }
      
      if (!isValid) {
        invalidCount++;
      }
    } catch (validationError) {
      console.error(`Error validating file for message ${message.id}:`, validationError);
    }
  }
  
  // Log the validation results
  await supabase.from('unified_audit_logs').insert({
    event_type: 'storage_validation_completed',
    correlation_id: correlationId,
    metadata: {
      processed_count: messages?.length || 0,
      invalid_count: invalidCount,
      repaired_count: repairedCount,
      validation_options: { limit, onlyNewest, repair }
    },
    event_timestamp: new Date().toISOString()
  });
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        processed: messages?.length || 0,
        invalid: invalidCount,
        repaired: repairedCount,
        correlation_id: correlationId
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Repair storage paths for messages
async function repairStoragePaths(messageIds?: string[], correlationId: string) {
  // Query to find messages with missing or incomplete storage paths
  const query = supabase
    .from('messages')
    .select('id, file_unique_id, mime_type')
    .eq('deleted_from_telegram', false)
    .is('file_unique_id', 'not', null)
    .or('storage_path.is.null,public_url.is.null');
    
  // If specific message IDs provided, use those
  if (messageIds && messageIds.length > 0) {
    query.in('id', messageIds);
  } else {
    // Otherwise limit to recent messages
    query.order('created_at', { ascending: false }).limit(50);
  }
  
  const { data: messages, error: queryError } = await query;
  
  if (queryError) {
    throw new Error(`Failed to fetch messages for storage path repair: ${queryError.message}`);
  }
  
  let repairedCount = 0;
  
  // Fix paths for each message
  for (const message of messages || []) {
    try {
      // Generate proper storage path based on file_unique_id and mime_type
      const fileExt = message.mime_type ? 
        message.mime_type.split('/')[1] : 
        (message.mime_type?.includes('video') ? 'mp4' : 'jpeg');
        
      const storagePath = `${message.file_unique_id}.${fileExt}`;
      const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
      
      // Update the message with correct paths
      await supabase
        .from('messages')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
        
      repairedCount++;
    } catch (repairError) {
      console.error(`Error repairing storage path for message ${message.id}:`, repairError);
    }
  }
  
  // Log the repair results
  await supabase.from('unified_audit_logs').insert({
    event_type: 'storage_paths_repaired',
    correlation_id: correlationId,
    metadata: {
      messages_processed: messages?.length || 0,
      repaired_count: repairedCount,
      specific_ids: messageIds ? true : false
    },
    event_timestamp: new Date().toISOString()
  });
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        processed: messages?.length || 0,
        repaired: repairedCount,
        correlation_id: correlationId
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Serve the wrapped handler
serve(withErrorHandling('media-management', handleMediaManagement));

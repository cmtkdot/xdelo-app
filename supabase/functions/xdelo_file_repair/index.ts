
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { Message } from "../_shared/types.ts";

interface FileRepairOptions {
  messageIds?: string[];
  mediaGroupId?: string;
  limit?: number;
  forceRedownload?: boolean;
  fixContentType?: boolean;
  fixContentDisposition?: boolean;
  fixStoragePaths?: boolean;
  fixMimeTypes?: boolean;
  checkStorageOnly?: boolean;
  dryRun?: boolean;
}

// Default MIME type map for content disposition
const contentDispositionMap: Record<string, 'inline' | 'attachment'> = {
  // Images - inline
  'image/jpeg': 'inline',
  'image/jpg': 'inline',
  'image/png': 'inline',
  'image/gif': 'inline',
  'image/webp': 'inline',
  'image/svg+xml': 'inline',
  
  // Videos - inline
  'video/mp4': 'inline',
  'video/quicktime': 'inline',
  'video/webm': 'inline',
  'video/ogg': 'inline',
  
  // Documents - attachment
  'application/pdf': 'attachment',
  'application/msword': 'attachment',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'attachment',
  'application/vnd.ms-excel': 'attachment',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'attachment',
  
  // Default
  'application/octet-stream': 'attachment'
};

/**
 * Determines the appropriate content disposition based on MIME type
 */
function getContentDisposition(mimeType: string): 'inline' | 'attachment' {
  if (!mimeType) return 'attachment';
  return contentDispositionMap[mimeType] || 'attachment';
}

/**
 * Fix content disposition for a file
 */
async function fixContentDisposition(message: Message, dryRun = false) {
  if (!message.mime_type || !message.storage_path) {
    return {
      success: false,
      message_id: message.id,
      action: 'failed',
      reason: 'Missing mime type or storage path'
    };
  }
  
  try {
    const disposition = getContentDisposition(message.mime_type);
    
    if (!dryRun) {
      // 1. Update Supabase Storage metadata
      const { error: updateError } = await supabaseClient.storage
        .from('telegram-media')
        .updateMetadata(message.storage_path, {
          cacheControl: 'public, max-age=31536000',
          contentType: message.mime_type,
          contentDisposition: `${disposition}; filename="${message.file_unique_id}"`
        });
      
      if (updateError) throw updateError;
      
      // 2. Update the message record
      const { error: dbError } = await supabaseClient
        .from('messages')
        .update({
          content_disposition: disposition,
          mime_type_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      if (dbError) throw dbError;
      
      // Log the repair action
      await supabaseClient
        .from('unified_audit_logs')
        .insert({
          event_type: 'content_disposition_updated',
          entity_id: message.id,
          metadata: {
            disposition,
            mime_type: message.mime_type,
            storage_path: message.storage_path
          }
        });
    }
    
    return {
      success: true,
      message_id: message.id,
      action: 'repaired',
      disposition,
      dry_run: dryRun
    };
  } catch (error) {
    return {
      success: false,
      message_id: message.id,
      action: 'failed',
      error: error.message
    };
  }
}

/**
 * Verify storage exists for a message
 */
async function verifyStorage(message: Message, dryRun = false) {
  if (!message.storage_path) {
    return {
      success: false,
      message_id: message.id,
      action: 'failed',
      reason: 'Missing storage path'
    };
  }
  
  try {
    // Check if file exists in storage
    const { data, error } = await supabaseClient.storage
      .from('telegram-media')
      .getPublicUrl(message.storage_path);
    
    if (error) throw error;
    
    if (!dryRun) {
      // Update the message to mark storage as verified
      await supabaseClient
        .from('messages')
        .update({
          storage_exists: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      // Log the verification
      await supabaseClient
        .from('unified_audit_logs')
        .insert({
          event_type: 'storage_file_verified',
          entity_id: message.id,
          metadata: {
            storage_path: message.storage_path,
            public_url: data.publicUrl
          }
        });
    }
    
    return {
      success: true,
      message_id: message.id,
      action: 'verified',
      public_url: data.publicUrl
    };
  } catch (error) {
    if (!dryRun) {
      // Mark file as needing redownload
      await supabaseClient
        .from('messages')
        .update({
          storage_exists: false,
          needs_redownload: true,
          redownload_reason: 'File not found in storage',
          redownload_flagged_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      // Log the missing file
      await supabaseClient
        .from('unified_audit_logs')
        .insert({
          event_type: 'storage_file_missing',
          entity_id: message.id,
          metadata: {
            storage_path: message.storage_path,
            error: error.message
          }
        });
    }
    
    return {
      success: false,
      message_id: message.id,
      action: 'failed',
      error: error.message,
      reason: 'File not found in storage'
    };
  }
}

/**
 * Repair function implementation
 */
async function repairFiles(options: FileRepairOptions) {
  const results = {
    success: true,
    processed: 0,
    repaired: 0,
    verified: 0,
    failed: 0,
    details: [] as any[]
  };
  
  let messages: Message[] = [];
  
  // Get messages to process
  if (options.messageIds && options.messageIds.length > 0) {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .in('id', options.messageIds);
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    messages = data || [];
  } else if (options.mediaGroupId) {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('media_group_id', options.mediaGroupId);
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    messages = data || [];
  } else {
    // No specific messages requested, use a limited set that need repair
    const query = supabaseClient
      .from('messages')
      .select('*');
    
    if (options.checkStorageOnly) {
      query.or('storage_exists.is.null,storage_exists.eq.false');
    } else {
      query.or('content_disposition.is.null,mime_type_verified.is.null,mime_type_verified.eq.false');
    }
    
    const limit = options.limit || 50;
    const { data, error } = await query.limit(limit);
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    messages = data || [];
  }
  
  // Process each message
  for (const message of messages) {
    results.processed++;
    
    try {
      // First verify storage exists
      const storageResult = await verifyStorage(message, options.dryRun);
      results.details.push(storageResult);
      
      if (storageResult.success) {
        results.verified++;
        
        // Now fix content disposition if needed
        if ((options.fixContentType || options.fixContentDisposition) && 
            (!message.content_disposition || !message.mime_type_verified)) {
          const fixResult = await fixContentDisposition(message, options.dryRun);
          results.details.push(fixResult);
          
          if (fixResult.success) {
            results.repaired++;
          } else {
            results.failed++;
          }
        }
      } else {
        results.failed++;
      }
      
      // Add other repair functionality as needed
      // e.g., fixStoragePaths, fixMimeTypes, etc.
      
    } catch (error) {
      results.failed++;
      results.details.push({
        message_id: message.id,
        action: 'failed',
        error: error.message
      });
    }
  }
  
  // Log overall repair operation
  await supabaseClient
    .from('unified_audit_logs')
    .insert({
      event_type: 'media_repair_completed',
      entity_id: 'repair-session-' + Date.now(),
      metadata: {
        processed: results.processed,
        repaired: results.repaired,
        verified: results.verified,
        failed: results.failed,
        options
      }
    });
  
  return results;
}

/**
 * Main serve function for Deno
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as FileRepairOptions;
    const result = await repairFiles(body);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    
    // Log the error
    try {
      await supabaseClient
        .from('unified_audit_logs')
        .insert({
          event_type: 'media_repair_failed',
          entity_id: 'repair-session-' + Date.now(),
          metadata: {
            error: error.message
          },
          error_message: error.message
        });
    } catch (e) {
      console.error("Failed to log error:", e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

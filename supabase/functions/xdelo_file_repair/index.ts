
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { Message } from "../_shared/types.ts";

interface FileRepairOptions {
  messageIds?: string[];
  mediaGroupId?: string;
  fixContentDisposition?: boolean;
  fixStoragePaths?: boolean;
  fixMimeTypes?: boolean;
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
      error: 'Missing mime type or storage path'
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
    }
    
    return {
      success: true,
      message_id: message.id,
      disposition,
      dry_run: dryRun
    };
  } catch (error) {
    return {
      success: false,
      message_id: message.id,
      error: error.message
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
    successful: 0,
    failed: 0,
    errors: [] as any[],
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
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .is('content_disposition', null)
      .is('storage_exists', true)
      .is('mime_type_verified', false)
      .limit(100);
    
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
      if (options.fixContentDisposition) {
        const fixResult = await fixContentDisposition(message, options.dryRun);
        results.details.push(fixResult);
        
        if (fixResult.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(fixResult);
        }
      }
      
      // Add other repair functionality as needed
      // e.g., fixStoragePaths, fixMimeTypes, etc.
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        message_id: message.id,
        error: error.message
      });
    }
  }
  
  results.success = results.failed === 0;
  
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
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

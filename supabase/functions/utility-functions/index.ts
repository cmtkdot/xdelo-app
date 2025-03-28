
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, messageId, caption, correlationId, messageIds, limit } = await req.json();
    
    // Generate a unique correlation ID if not provided
    const requestCorrelationId = correlationId || crypto.randomUUID();
    
    console.log(`Processing utility function request: ${action}, correlation ID: ${requestCorrelationId}`);
    
    // Route to the appropriate handler based on the action
    switch (action) {
      case 'process_caption':
        return await handleProcessCaption(messageId, caption, requestCorrelationId);
      
      case 'reupload_media':
        return await handleReuploadMedia(messageId, requestCorrelationId);
      
      case 'fix_content_disposition':
        return await handleFixContentDisposition(messageId, requestCorrelationId);
      
      case 'repair_media_batch':
        return await handleRepairMediaBatch(messageIds, limit, requestCorrelationId);
      
      case 'standardize_paths':
        return await handleStandardizePaths(messageIds, limit, requestCorrelationId);
      
      case 'fix_media_urls':
        return await handleFixMediaUrls(messageIds, limit, requestCorrelationId);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error in utility-functions: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

/**
 * Process and analyze a message caption
 */
async function handleProcessCaption(messageId: string, caption?: string, correlationId: string = crypto.randomUUID()) {
  if (!messageId) {
    throw new Error("messageId is required");
  }
  
  try {
    // First, if a caption is provided, update the message's caption
    if (caption !== undefined) {
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({ 
          caption,
          updated_at: new Date().toISOString(),
          needs_caption_analysis: true,
          correlation_id: correlationId
        })
        .eq('id', messageId);
        
      if (updateError) {
        throw new Error(`Error updating caption: ${updateError.message}`);
      }
    }
    
    // Call the database function to analyze the caption
    const { data, error } = await supabaseClient.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_force: true
      }
    );
    
    if (error) {
      throw new Error(`Error analyzing caption: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption processed successfully",
        message_id: messageId,
        caption_updated: caption !== undefined,
        media_group_synced: data?.media_group_synced || false,
        analyzed_content: data?.analyzed_content || null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error processing caption: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Re-upload media from Telegram
 */
async function handleReuploadMedia(messageId: string, correlationId: string) {
  if (!messageId) {
    throw new Error("messageId is required");
  }
  
  try {
    // Update message to trigger re-download
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        needs_redownload: true,
        redownload_reason: 'manual_request',
        redownload_flagged_at: new Date().toISOString(),
        redownload_attempts: 0,
        correlation_id: correlationId
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }
    
    // Log the reupload request
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'manual_reupload_requested',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'utility-functions'
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Media reupload requested",
        message_id: messageId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error requesting media reupload: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Fix content disposition for a message
 */
async function handleFixContentDisposition(messageId: string, correlationId: string) {
  if (!messageId) {
    throw new Error("messageId is required");
  }
  
  try {
    // Get the message to check its mime type
    const { data: message, error: getError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (getError) {
      throw new Error(`Error getting message: ${getError.message}`);
    }
    
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    // Update the content disposition based on the mime type
    let contentDisposition = 'attachment';
    if (message.mime_type && (
        message.mime_type.startsWith('image/') || 
        message.mime_type.startsWith('video/') ||
        message.mime_type === 'application/pdf'
    )) {
      contentDisposition = 'inline';
    }
    
    // Update the message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        content_disposition: contentDisposition,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }
    
    // Log the fix
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'content_disposition_fixed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        old_content_disposition: message.content_disposition,
        new_content_disposition: contentDisposition,
        timestamp: new Date().toISOString(),
        source: 'utility-functions'
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Content disposition set to ${contentDisposition}`,
        message_id: messageId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error fixing content disposition: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Repair a batch of media files
 */
async function handleRepairMediaBatch(messageIds?: string[], limit: number = 50, correlationId: string = crypto.randomUUID()) {
  try {
    // Call the redownload-missing-files function
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/redownload-missing-files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          messageIds,
          limit,
          correlationId
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error calling redownload-missing-files: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: result.queued || 0,
        message: `Queued ${result.queued || 0} messages for repair`,
        successful: result.queued || 0,
        failed: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in repair media batch: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        repaired: 0,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Standardize storage paths for messages
 */
async function handleStandardizePaths(messageIds?: string[], limit: number = 50, correlationId: string = crypto.randomUUID()) {
  try {
    let query = supabaseClient
      .from('messages')
      .select('id, storage_path, file_unique_id')
      .not('storage_path', 'is', null);
    
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error querying messages: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          repaired: 0,
          message: "No messages found needing path standardization",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Generate standardized paths
    const updates = data.map(message => {
      if (!message.storage_path) return null;
      
      // Extract file extension from the storage path
      const fileExtension = message.storage_path.split('.').pop();
      const ext = fileExtension ? `.${fileExtension}` : '';
      const newPath = `media/${message.file_unique_id}${ext}`;
      
      return {
        id: message.id,
        storage_path: newPath,
        storage_path_standardized: true,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${newPath}`,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId
      };
    }).filter(Boolean);
    
    if (updates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          repaired: 0,
          message: "No valid paths to standardize",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: updates.length,
        message: `Standardized paths for ${updates.length} messages`,
        successful: updates.length,
        failed: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in standardize paths: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        repaired: 0,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Fix media URLs
 */
async function handleFixMediaUrls(messageIds?: string[], limit: number = 50, correlationId: string = crypto.randomUUID()) {
  try {
    let query = supabaseClient
      .from('messages')
      .select('id, storage_path')
      .not('storage_path', 'is', null)
      .is('public_url', null);
    
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error querying messages: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          repaired: 0,
          message: "No messages found needing URL fixes",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Generate correct URLs
    const updates = data.map(message => {
      if (!message.storage_path) return null;
      
      return {
        id: message.id,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${message.storage_path}`,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId
      };
    }).filter(Boolean);
    
    if (updates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          repaired: 0,
          message: "No valid URLs to fix",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: updates.length,
        message: `Fixed URLs for ${updates.length} messages`,
        successful: updates.length,
        failed: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in fix media URLs: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        repaired: 0,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Helper function to get file extension
 */
function getFileExtension(path: string | null): string {
  if (!path) return '';
  const parts = path.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

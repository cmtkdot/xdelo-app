
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
    const { action, messageId, caption, mediaGroupId, correlationId, messageIds, batch_size, auto_repair } = await req.json();
    
    // Generate a unique correlation ID if not provided
    const requestCorrelationId = correlationId || crypto.randomUUID();
    
    console.log(`Processing utility function request: ${action}, correlation ID: ${requestCorrelationId}`);
    
    // Route to the appropriate handler based on the action
    switch (action) {
      case 'process_caption':
        return await handleProcessCaption(req, requestCorrelationId);
      
      case 'reupload_media':
        return await handleReuploadMedia(messageId, requestCorrelationId);
      
      case 'fix_content_disposition':
        return await handleFixContentDisposition(messageId, requestCorrelationId);
      
      case 'repair_media_batch':
        return await handleRepairMediaBatch(messageIds, requestCorrelationId);
      
      case 'standardize_paths':
        return await handleStandardizePaths(messageIds, batch_size, requestCorrelationId);
      
      case 'fix_media_urls':
        return await handleFixMediaUrls(messageIds, requestCorrelationId);
        
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
async function handleProcessCaption(req: Request, correlationId: string) {
  const { messageId, caption } = await req.json();
  
  if (!messageId) {
    throw new Error("messageId is required");
  }
  
  try {
    // Call the manual caption parser function to process the caption
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/manual-caption-parser`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          messageId: messageId,
          caption: caption,
          correlationId: correlationId,
          isEdit: caption ? true : false,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error from caption parser: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption processed successfully",
        ...result
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
async function handleRepairMediaBatch(messageIds?: string[], correlationId: string = crypto.randomUUID()) {
  try {
    let query = supabaseClient
      .from('messages')
      .select('id, file_id, needs_redownload, storage_path, public_url')
      .is('storage_exists', false);
    
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.is('needs_redownload', false).limit(50);
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
          message: "No messages found needing repair",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Flag all messages for redownload
    const updates = data.map(message => ({
      id: message.id,
      needs_redownload: true,
      redownload_reason: 'repair_batch',
      redownload_flagged_at: new Date().toISOString(),
      redownload_attempts: 0,
      correlation_id: correlationId
    }));
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: data.length,
        message: `Flagged ${data.length} messages for repair`,
        details: data.map(m => m.id)
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
async function handleStandardizePaths(messageIds?: string[], batchSize: number = 50, correlationId: string = crypto.randomUUID()) {
  try {
    let query = supabaseClient
      .from('messages')
      .select('id, storage_path, file_unique_id')
      .is('storage_path_standardized', false);
    
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.limit(batchSize);
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
      const fileExtension = getFileExtension(message.storage_path);
      const newPath = `media/${message.file_unique_id}${fileExtension}`;
      
      return {
        id: message.id,
        storage_path: newPath,
        storage_path_standardized: true,
        public_url: `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${newPath}`,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId
      };
    });
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: data.length,
        message: `Standardized paths for ${data.length} messages`,
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
async function handleFixMediaUrls(messageIds?: string[], correlationId: string = crypto.randomUUID()) {
  try {
    let query = supabaseClient
      .from('messages')
      .select('id, storage_path')
      .not('storage_path', 'is', null);
    
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      query = query.limit(50);
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
    const updates = data.map(message => ({
      id: message.id,
      public_url: `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${message.storage_path}`,
      updated_at: new Date().toISOString(),
      correlation_id: correlationId
    }));
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: data.length,
        message: `Fixed URLs for ${data.length} messages`,
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

// Helper function to get file extension from a path
function getFileExtension(path?: string): string {
  if (!path) return '';
  
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  if (match && match[1]) {
    return '.' + match[1].toLowerCase();
  }
  return '';
}

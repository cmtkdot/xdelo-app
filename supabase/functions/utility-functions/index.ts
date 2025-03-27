
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create an authenticated Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase URL or service role key');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const { action, messageId, messageIds, limit = 100 } = await req.json();

    // Generate a correlation ID for tracking this operation
    const correlationId = crypto.randomUUID();
    console.log(`[utility-functions] Processing action ${action} with correlation ID ${correlationId}`);

    // Handle different actions
    switch (action) {
      case 'reset_stalled_messages':
        return await resetStalledMessages(supabase, correlationId);
      
      case 'repair_media_batch':
        return await repairMediaBatch(supabase, messageIds || [], correlationId);
      
      case 'standardize_paths':
        return await standardizeStoragePaths(supabase, limit, correlationId);
      
      case 'fix_media_urls':
        return await fixMediaUrls(supabase, messageIds || [], correlationId);
      
      case 'reupload_media':
        return await reuploadMediaFromTelegram(supabase, messageId, correlationId);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`[utility-functions] Error: ${error.message}`);
    
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

// Reset messages that are stuck in processing
async function resetStalledMessages(supabase, correlationId) {
  try {
    // Call database function to reset stalled messages
    const { data, error } = await supabase.rpc('xdelo_reset_stalled_messages');
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({
        success: true,
        reset_count: data.reset_count || 0,
        message: `Reset ${data.reset_count || 0} stuck messages`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[reset-stalled] Error: ${error.message}`);
    throw error;
  }
}

// Repair a batch of media messages
async function repairMediaBatch(supabase, messageIds, correlationId) {
  try {
    if (!messageIds || messageIds.length === 0) {
      throw new Error('No message IDs provided');
    }
    
    // Use the RPC function to repair the media
    const { data, error } = await supabase.rpc('xdelo_fix_mime_types', {
      p_message_ids: messageIds
    });
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: data?.length || 0,
        details: data || [],
        message: `Repaired ${data?.length || 0} messages`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[repair-media] Error: ${error.message}`);
    throw error;
  }
}

// Standardize storage paths
async function standardizeStoragePaths(supabase, limit, correlationId) {
  try {
    // Use the RPC function to standardize paths
    const { data, error } = await supabase.rpc('xdelo_fix_storage_paths', {
      p_limit: limit
    });
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: data?.length || 0,
        details: data || [],
        message: `Standardized ${data?.length || 0} storage paths`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[standardize-paths] Error: ${error.message}`);
    throw error;
  }
}

// Fix media URLs
async function fixMediaUrls(supabase, messageIds, correlationId) {
  try {
    // Get messages with missing or invalid URLs
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, telegram_data, file_id, file_unique_id')
      .in('id', messageIds.length > 0 ? messageIds : ['no-results']);

    if (fetchError) throw fetchError;
    
    let fixedCount = 0;
    const results = [];
    
    for (const message of messages || []) {
      try {
        // Update the URL based on Telegram data
        const { data, error } = await supabase
          .from('messages')
          .update({
            storage_path: `telegram/${message.file_unique_id}`,
          })
          .eq('id', message.id)
          .select('id');
        
        if (error) throw error;
        
        fixedCount++;
        results.push({ id: message.id, success: true });
      } catch (err) {
        results.push({ id: message.id, success: false, error: err.message });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        repaired: fixedCount,
        details: results,
        message: `Fixed ${fixedCount} URLs out of ${messages?.length || 0} messages`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[fix-urls] Error: ${error.message}`);
    throw error;
  }
}

// Reupload media from Telegram
async function reuploadMediaFromTelegram(supabase, messageId, correlationId) {
  try {
    if (!messageId) {
      throw new Error('No message ID provided');
    }
    
    // Get the message to check if it has valid telegram data
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('id, telegram_data, file_id')
      .eq('id', messageId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!message || !message.telegram_data || !message.file_id) {
      throw new Error('Message does not have valid Telegram data');
    }
    
    // Call the redownload function in the database
    const { data, error } = await supabase.rpc('xdelo_redownload_media_file', {
      p_message_id: messageId
    });
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Media file reuploaded successfully',
        details: data
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[reupload-media] Error: ${error.message}`);
    throw error;
  }
}

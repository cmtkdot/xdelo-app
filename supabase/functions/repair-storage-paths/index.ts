
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient as supabase } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageIds, limit = 100, checkStorage = true } = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`Repair storage paths request: correlationId=${correlationId}, messageCount=${messageIds?.length || 'all'}, limit=${limit}, checkStorage=${checkStorage}`);
    
    // Call the database function to standardize paths
    const { data, error } = await supabase.rpc(
      'xdelo_fix_storage_paths',
      {
        p_limit: limit,
        p_only_check: false
      }
    );
    
    if (error) {
      throw new Error(`Failed to standardize storage paths: ${error.message}`);
    }
    
    const results = {
      processed: data?.length || 0,
      fixed: 0,
      needs_redownload: 0,
      details: []
    };
    
    // Process the results
    if (data && data.length > 0) {
      for (const item of data) {
        results.details.push(item);
        if (item.fixed) results.fixed++;
        if (item.needs_redownload) results.needs_redownload++;
      }
      
      // If requested, check actual storage existence for fixed paths
      if (checkStorage && results.fixed > 0) {
        const messageIdsToCheck = data
          .filter(item => item.fixed && !item.needs_redownload)
          .map(item => item.message_id);
          
        if (messageIdsToCheck.length > 0) {
          console.log(`Checking storage existence for ${messageIdsToCheck.length} fixed paths`);
          
          // Get the messages with their new paths
          const { data: messages } = await supabase
            .from('messages')
            .select('id, storage_path')
            .in('id', messageIdsToCheck);
            
          if (messages && messages.length > 0) {
            for (const message of messages) {
              try {
                const { data: signedUrl, error: signedUrlError } = await supabase
                  .storage
                  .from('telegram-media')
                  .createSignedUrl(message.storage_path, 60);
                  
                const exists = !signedUrlError && !!signedUrl;
                
                // Update storage_exists flag
                await supabase
                  .from('messages')
                  .update({ storage_exists: exists })
                  .eq('id', message.id);
                  
                // If file doesn't exist, mark for redownload
                if (!exists) {
                  await supabase
                    .from('messages')
                    .update({
                      needs_redownload: true,
                      redownload_reason: 'Storage path fixed but file not found',
                      redownload_flagged_at: new Date().toISOString()
                    })
                    .eq('id', message.id);
                    
                  results.needs_redownload++;
                }
              } catch (error) {
                console.error(`Error checking storage for message ${message.id}:`, error);
              }
            }
          }
        }
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'storage_paths_repaired',
      correlation_id: correlationId,
      metadata: {
        processed: results.processed,
        fixed: results.fixed,
        needs_redownload: results.needs_redownload,
        specific_message_ids: messageIds && messageIds.length > 0
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in repair-storage-paths:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

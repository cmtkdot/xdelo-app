import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper to determine if the MIME type is viewable in browser
function isViewableMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType === 'application/pdf';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageIds, fixContentDisposition } = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`Repair storage paths request: correlationId=${correlationId}, messageIds=${JSON.stringify(messageIds)}, fixContentDisposition=${fixContentDisposition}`);
    
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
    let contentDispositionFixed = 0;
    
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
          console.log(`Updated storage path for message ${message.id}: ${message.storage_path} -> ${storagePath}`);
        }
        
        // Fix content disposition if requested
        if (fixContentDisposition && isViewableMimeType(message.mime_type)) {
          // Check if file exists
          const { data: fileExists } = await supabase
            .storage
            .from('telegram-media')
            .list('', {
              limit: 1,
              search: storagePath
            });
            
          if (fileExists && fileExists.length > 0) {
            try {
              // Get current file metadata
              const { data: fileData } = await supabase
                .storage
                .from('telegram-media')
                .download(storagePath);
                
              if (fileData) {
                // Re-upload with inline content disposition
                const { error: uploadError } = await supabase
                  .storage
                  .from('telegram-media')
                  .upload(storagePath, fileData, {
                    contentType: message.mime_type,
                    contentDisposition: 'inline',
                    upsert: true
                  });
                  
                if (!uploadError) {
                  contentDispositionFixed++;
                  console.log(`Fixed content disposition for ${message.id} (${storagePath})`);
                }
              }
            } catch (fileError) {
              console.error(`Error fixing content disposition for ${message.id}:`, fileError);
            }
          }
        }
      } catch (messageError) {
        console.error(`Error processing message ${message.id}:`, messageError);
      }
    }
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'storage_paths_repaired',
      correlation_id: correlationId,
      metadata: {
        messages_processed: messages?.length || 0,
        repaired_count: repairedCount,
        content_disposition_fixed: contentDispositionFixed,
        specific_message_ids: messageIds && messageIds.length > 0
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          processed: messages?.length || 0,
          repaired: repairedCount,
          contentDispositionFixed,
          correlation_id: correlationId
        }
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

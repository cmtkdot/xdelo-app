
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

async function repairStoragePaths(specificMessageIds?: string[], fixContentDisposition = false): Promise<any> {
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
    
    // If requested, fix content disposition for viewable media types
    if (fixContentDisposition) {
      // Get files that should have inline content disposition
      const { data: mediaFiles, error: mediaError } = await supabase
        .from('messages')
        .select('id, file_unique_id, mime_type, storage_path')
        .or('mime_type.ilike.image/%,mime_type.ilike.video/%,mime_type.eq.application/pdf')
        .is('storage_path', 'not.null');
      
      if (mediaError) throw mediaError;
      
      console.log(`Found ${mediaFiles?.length || 0} media files to fix content disposition`);
      
      let repaired = 0;
      
      // Process each file to set inline content disposition
      for (const file of mediaFiles || []) {
        if (!file.storage_path) continue;
        
        try {
          // Get the file metadata
          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('telegram-media')
            .download(file.storage_path);
          
          if (fileError || !fileData) {
            console.warn(`Could not download file ${file.storage_path}: ${fileError?.message}`);
            continue;
          }
          
          // Re-upload with inline content disposition
          const { error: uploadError } = await supabase
            .storage
            .from('telegram-media')
            .upload(file.storage_path, fileData, {
              contentType: file.mime_type || 'application/octet-stream',
              upsert: true,
              contentDisposition: 'inline'
            });
          
          if (uploadError) {
            console.error(`Error fixing content disposition for ${file.storage_path}: ${uploadError.message}`);
          } else {
            repaired++;
          }
        } catch (error) {
          console.error(`Error processing file ${file.storage_path}: ${error.message}`);
        }
      }
      
      console.log(`Fixed content disposition for ${repaired} files`);
      
      return {
        success: true,
        repaired: data?.length || 0,
        contentDispositionFixed: repaired,
        details: data
      };
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageIds, fixContentDisposition = false } = await req.json();
    
    const results = await repairStoragePaths(messageIds, fixContentDisposition);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

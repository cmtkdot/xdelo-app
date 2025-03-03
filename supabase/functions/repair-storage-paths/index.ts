
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageIds } = await req.json();
    
    const results = await repairStoragePaths(messageIds);
    
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

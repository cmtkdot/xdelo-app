
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { 
  xdelo_checkFileExistsInStorage,
  xdelo_constructStoragePath 
} from "../_shared/mediaUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function validateStorage(batchSize: number = 50): Promise<any> {
  try {
    console.log(`Starting storage validation with batch size: ${batchSize}`);
    
    // First, repair any malformed storage paths
    const { data: repairResult, error: repairError } = await supabase.rpc('xdelo_repair_storage_paths');
    
    if (repairError) {
      console.error('Error repairing storage paths:', repairError);
    }
    
    // Get messages that need validation
    const { data: messages, error: queryError } = await supabase
      .from('messages')
      .select('id, file_unique_id, file_id, storage_path, mime_type')
      .is('needs_redownload', null) // Only check messages not already flagged
      .order('created_at', { ascending: false })
      .limit(batchSize);
    
    if (queryError) {
      console.error('Error querying messages for validation:', queryError);
      throw queryError;
    }
    
    console.log(`Found ${messages?.length || 0} messages to validate`);
    
    const results = {
      checked: 0,
      valid: 0,
      invalid: 0,
      flagged: 0,
      repaired: repairResult?.length || 0,
      details: []
    };
    
    // Check each message's file directly in storage
    for (const message of messages || []) {
      results.checked++;
      
      // Skip messages without necessary data
      if (!message.file_unique_id || !message.mime_type) {
        console.log(`Skipping message ${message.id}: Missing file_unique_id or mime_type`);
        continue;
      }
      
      try {
        // Generate standardized storage path
        const storagePath = xdelo_constructStoragePath(message.file_unique_id, message.mime_type);
        
        // Check if file exists directly in storage
        const exists = await xdelo_checkFileExistsInStorage(
          message.file_unique_id, 
          message.mime_type
        );
        
        if (exists) {
          // File exists
          results.valid++;
          
          // Update validation record
          await supabase
            .from('storage_validations')
            .upsert({
              file_unique_id: message.file_unique_id,
              storage_path: storagePath,
              last_checked_at: new Date().toISOString(),
              is_valid: true,
              error_message: null
            }, { onConflict: 'file_unique_id' });
            
          // If the storage_path is different from our standard path, update it
          if (message.storage_path !== storagePath) {
            await supabase
              .from('messages')
              .update({
                storage_path: storagePath,
                public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`
              })
              .eq('id', message.id);
          }
            
          results.details.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'valid',
            storage_path: storagePath
          });
        } else {
          // File doesn't exist
          results.invalid++;
          
          // Update validation record
          await supabase
            .from('storage_validations')
            .upsert({
              file_unique_id: message.file_unique_id,
              storage_path: storagePath,
              last_checked_at: new Date().toISOString(),
              is_valid: false,
              error_message: 'File not found in storage'
            }, { onConflict: 'file_unique_id' });
          
          // Flag for redownload
          const { error: flagError } = await supabase
            .from('messages')
            .update({
              needs_redownload: true,
              redownload_reason: 'File not found in scheduler validation',
              redownload_flagged_at: new Date().toISOString(),
              storage_path: storagePath, // Ensure standardized path for redownload
              public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`
            })
            .eq('id', message.id);
          
          if (!flagError) {
            results.flagged++;
          }
          
          results.details.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'invalid',
            storage_path: storagePath,
            error: 'File not found in storage',
            flagged: !flagError
          });
        }
      } catch (error) {
        console.error(`Error checking file for message ${message.id}:`, error);
        
        // Flag for redownload on error
        const { error: flagError } = await supabase
          .from('messages')
          .update({
            needs_redownload: true,
            redownload_reason: `Check error: ${error.message}`,
            redownload_flagged_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'error',
          error: error.message,
          flagged: !flagError
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error validating storage:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { batchSize = 50 } = await req.json();
    
    const results = await validateStorage(batchSize);
    
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

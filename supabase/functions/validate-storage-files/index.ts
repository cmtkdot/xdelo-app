
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

async function checkFileExists(bucketName: string, filePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .download(filePath);
    
    return (data != null && !error);
  } catch (error) {
    console.error(`Error checking file existence for ${filePath}:`, error);
    return false;
  }
}

async function validateMessageFiles(limit = 100, onlyNewest = true): Promise<any> {
  try {
    // Get messages to validate
    let query = supabase
      .from('messages')
      .select('id, file_unique_id, storage_path, mime_type, public_url')
      .not('file_unique_id', 'is', null);
    
    if (onlyNewest) {
      query = query.order('created_at', { ascending: false });
    }
    
    const { data: messages, error } = await query.limit(limit);
    
    if (error) throw new Error(`Database query error: ${error.message}`);
    
    const results = {
      processed: 0,
      valid: 0,
      invalid: 0,
      repaired: 0,
      details: []
    };
    
    // Validate each message's storage file
    for (const message of messages) {
      results.processed++;
      
      // Skip messages without storage path or file_unique_id
      if (!message.storage_path || !message.file_unique_id) {
        // Repair missing storage path
        const extension = message.mime_type ? message.mime_type.split('/')[1] : 'jpeg';
        const newStoragePath = `${message.file_unique_id}.${extension}`;
        
        // Update the message with the correct path
        const { error } = await supabase
          .from('messages')
          .update({
            storage_path: newStoragePath,
            needs_redownload: true,
            redownload_reason: 'Missing storage path',
            redownload_flagged_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (error) {
          console.error(`Error repairing message ${message.id}:`, error);
          results.details.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'repair_failed',
            error: error.message
          });
        } else {
          results.repaired++;
          results.details.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            old_path: message.storage_path,
            new_path: newStoragePath,
            status: 'repaired'
          });
        }
        continue;
      }
      
      // Check if file exists in storage
      const exists = await checkFileExists('telegram-media', message.storage_path);
      
      // Update validation status
      await supabase
        .from('storage_validations')
        .upsert({
          file_unique_id: message.file_unique_id,
          storage_path: message.storage_path,
          last_checked_at: new Date().toISOString(),
          is_valid: exists,
          error_message: exists ? null : 'File not found in storage'
        }, { onConflict: 'file_unique_id' });
      
      if (exists) {
        results.valid++;
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'valid'
        });
      } else {
        results.invalid++;
        
        // Flag for redownload
        const { error } = await supabase
          .from('messages')
          .update({
            needs_redownload: true,
            redownload_reason: 'File not found in storage',
            redownload_flagged_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (error) {
          console.error(`Error flagging message ${message.id} for redownload:`, error);
        }
        
        results.details.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'invalid',
          flagged_for_redownload: !error
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error validating message files:', error);
    throw error;
  }
}

async function repairStoragePaths(): Promise<any> {
  try {
    // Call the database function to repair storage paths
    const { data, error } = await supabase.rpc('xdelo_repair_storage_paths');
    
    if (error) throw error;
    
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { action = 'validate', limit = 100, onlyNewest = true } = await req.json();
    
    let result;
    
    switch (action) {
      case 'validate':
        result = await validateMessageFiles(limit, onlyNewest);
        break;
      case 'repair':
        result = await repairStoragePaths();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

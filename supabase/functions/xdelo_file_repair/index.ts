
import { corsHeaders } from '../_shared/cors';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../_shared/types';

type RepairOperation = 'mime-types' | 'storage-paths' | 'file-ids' | 'all';

interface FileRepairRequest {
  operation: RepairOperation;
  limit?: number;
}

interface FileRepairResponse {
  success: boolean;
  message: string;
  stats?: {
    fixed: number;
    skipped: number;
    errors: number;
  };
}

// Create a Supabase client with the service role key
const supabaseAdmin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
    }
  }
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { operation = 'all', limit = 100 } = await req.json() as FileRepairRequest;
    
    // Execute the appropriate repair operation
    let response: FileRepairResponse;
    
    if (operation === 'mime-types' || operation === 'all') {
      response = await fixMimeTypes(limit);
      
      if (operation !== 'all') {
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    if (operation === 'storage-paths' || operation === 'all') {
      response = await repairStoragePaths(limit);
      
      if (operation !== 'all') {
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    if (operation === 'file-ids' || operation === 'all') {
      response = await fixInvalidFileIds(limit);
      
      if (operation !== 'all') {
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    // If operation is 'all', return a combined response
    if (operation === 'all') {
      response = {
        success: true,
        message: 'All repair operations completed',
        stats: {
          fixed: 0,
          skipped: 0,
          errors: 0
        }
      };
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in file repair function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error.message || 'An error occurred during file repair',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function fixMimeTypes(limit: number): Promise<FileRepairResponse> {
  try {
    // Get messages with incorrect or missing MIME types
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('id, file_id, mime_type, message_type')
      .or('mime_type.is.null,mime_type.eq.,mime_type.not.like.%/%')
      .not('file_id', 'is', null)
      .limit(limit);
    
    if (fetchError) throw fetchError;
    
    if (!messages || messages.length === 0) {
      return {
        success: true,
        message: 'No messages found needing MIME type fixes',
        stats: { fixed: 0, skipped: 0, errors: 0 }
      };
    }
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const message of messages) {
      try {
        let mimeType = '';
        
        // Determine correct MIME type based on message_type
        if (message.message_type === 'photo') {
          mimeType = 'image/jpeg';
        } else if (message.message_type === 'video') {
          mimeType = 'video/mp4';
        } else if (message.message_type === 'document') {
          // For documents, try to determine MIME type from file extension
          const fileId = message.file_id;
          if (fileId && fileId.includes('.')) {
            const extension = fileId.split('.').pop()?.toLowerCase();
            if (extension) {
              switch (extension) {
                case 'pdf': mimeType = 'application/pdf'; break;
                case 'doc': case 'docx': mimeType = 'application/msword'; break;
                case 'xls': case 'xlsx': mimeType = 'application/vnd.ms-excel'; break;
                case 'jpg': case 'jpeg': mimeType = 'image/jpeg'; break;
                case 'png': mimeType = 'image/png'; break;
                case 'mp4': mimeType = 'video/mp4'; break;
                default: mimeType = 'application/octet-stream';
              }
            } else {
              mimeType = 'application/octet-stream';
            }
          } else {
            mimeType = 'application/octet-stream';
          }
        } else {
          // For other types, use a generic MIME type
          mimeType = 'application/octet-stream';
        }
        
        // Update the message with the correct MIME type
        const { error: updateError } = await supabaseAdmin
          .from('messages')
          .update({ mime_type: mimeType })
          .eq('id', message.id);
        
        if (updateError) {
          errors++;
          console.error(`Error updating MIME type for message ${message.id}:`, updateError);
        } else {
          fixed++;
        }
      } catch (err) {
        errors++;
        console.error(`Error processing message ${message.id}:`, err);
      }
    }
    
    return {
      success: true,
      message: `Fixed ${fixed} messages with incorrect MIME types`,
      stats: { fixed, skipped, errors }
    };
  } catch (error) {
    console.error('Error fixing MIME types:', error);
    return {
      success: false,
      message: error.message || 'Failed to fix MIME types',
      stats: { fixed: 0, skipped: 0, errors: 1 }
    };
  }
}

async function repairStoragePaths(limit: number): Promise<FileRepairResponse> {
  try {
    // Get messages that need storage path repair
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('id, file_id, media_group_id, storage_path_standardized')
      .or('storage_path_standardized.is.null,storage_path_standardized.eq.false')
      .not('file_id', 'is', null)
      .limit(limit);
    
    if (fetchError) throw fetchError;
    
    if (!messages || messages.length === 0) {
      return {
        success: true,
        message: 'No messages found needing storage path repairs',
        stats: { fixed: 0, skipped: 0, errors: 0 }
      };
    }
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const message of messages) {
      try {
        // Standardize the storage path format
        let newFileId = message.file_id;
        
        // Fix common path issues
        if (newFileId) {
          // Remove double slashes
          newFileId = newFileId.replace(/\/\//g, '/');
          
          // Ensure paths start with /
          if (!newFileId.startsWith('/')) {
            newFileId = '/' + newFileId;
          }
          
          // Replace spaces with underscores
          newFileId = newFileId.replace(/\s+/g, '_');
          
          // Add media group ID to the path if available
          if (message.media_group_id && !newFileId.includes(message.media_group_id)) {
            const pathParts = newFileId.split('/');
            const fileName = pathParts.pop();
            pathParts.push(message.media_group_id);
            if (fileName) pathParts.push(fileName);
            newFileId = pathParts.join('/');
          }
        }
        
        if (newFileId !== message.file_id) {
          // Update the message with the standardized file ID
          const { error: updateError } = await supabaseAdmin
            .from('messages')
            .update({ 
              file_id: newFileId,
              storage_path_standardized: true
            })
            .eq('id', message.id);
          
          if (updateError) {
            errors++;
            console.error(`Error updating storage path for message ${message.id}:`, updateError);
          } else {
            fixed++;
          }
        } else {
          // Path is already standardized, just mark it as such
          const { error: updateError } = await supabaseAdmin
            .from('messages')
            .update({ storage_path_standardized: true })
            .eq('id', message.id);
          
          if (updateError) {
            errors++;
          } else {
            skipped++;
          }
        }
      } catch (err) {
        errors++;
        console.error(`Error processing message ${message.id}:`, err);
      }
    }
    
    return {
      success: true,
      message: `Fixed ${fixed} messages with non-standard storage paths`,
      stats: { fixed, skipped, errors }
    };
  } catch (error) {
    console.error('Error repairing storage paths:', error);
    return {
      success: false,
      message: error.message || 'Failed to repair storage paths',
      stats: { fixed: 0, skipped: 0, errors: 1 }
    };
  }
}

async function fixInvalidFileIds(limit: number): Promise<FileRepairResponse> {
  try {
    // Get messages with potentially invalid file IDs
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('id, file_id, media_unique_file_id, mime_type')
      .not('file_id', 'is', null)
      .not('mime_type', 'is', null)
      .limit(limit);
    
    if (fetchError) throw fetchError;
    
    if (!messages || messages.length === 0) {
      return {
        success: true,
        message: 'No messages found with file IDs to check',
        stats: { fixed: 0, skipped: 0, errors: 0 }
      };
    }
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const message of messages) {
      try {
        // Check if file exists in storage
        const { data: fileExists, error: fileCheckError } = await supabaseAdmin
          .storage
          .from('telegram-files')
          .list('', {
            limit: 1,
            offset: 0,
            search: message.file_id.split('/').pop()
          });
        
        if (fileCheckError) {
          console.error(`Error checking file existence for message ${message.id}:`, fileCheckError);
          errors++;
          continue;
        }
        
        const exists = fileExists && fileExists.length > 0;
        
        // Update the storage_exists flag
        const { error: updateError } = await supabaseAdmin
          .from('messages')
          .update({ storage_exists: exists })
          .eq('id', message.id);
        
        if (updateError) {
          errors++;
          console.error(`Error updating storage_exists for message ${message.id}:`, updateError);
        } else if (exists) {
          skipped++;  // File exists, no need to fix
        } else {
          fixed++;    // File doesn't exist, marked as such
        }
      } catch (err) {
        errors++;
        console.error(`Error processing message ${message.id}:`, err);
      }
    }
    
    return {
      success: true,
      message: `Checked ${messages.length} file IDs (${fixed} marked as missing)`,
      stats: { fixed, skipped, errors }
    };
  } catch (error) {
    console.error('Error fixing invalid file IDs:', error);
    return {
      success: false,
      message: error.message || 'Failed to fix invalid file IDs',
      stats: { fixed: 0, skipped: 0, errors: 1 }
    };
  }
}


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient as supabase } from "../_shared/supabase.ts";
import { xdelo_detectMimeType, xdelo_validateStoragePath } from "../_shared/mediaUtils.ts";

interface StoragePathResult {
  message_id: string;
  original_path?: string;
  standardized_path: string;
  success: boolean;
  error?: string;
}

// Function to standardize a storage path for a message
async function standardizeStoragePath(messageId: string): Promise<StoragePathResult> {
  try {
    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Error fetching message: ${messageError.message}`);
    }

    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    if (!message.file_unique_id) {
      throw new Error(`Message is missing file_unique_id: ${messageId}`);
    }

    // Get the standardized path
    const { data: standardizedPath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type || ''
      }
    );

    if (pathError) {
      throw new Error(`Error standardizing path: ${pathError.message}`);
    }

    // Check if the current storage path is already standardized
    if (message.storage_path === standardizedPath) {
      return {
        message_id: messageId,
        original_path: message.storage_path,
        standardized_path: standardizedPath,
        success: true
      };
    }

    // If the file exists in storage at the current path, move it to the standardized path
    if (message.storage_path && message.storage_exists) {
      try {
        // Copy to the new standardized path
        const { error: copyError } = await supabase.storage
          .from('telegram-media')
          .copy(message.storage_path, standardizedPath);

        if (!copyError) {
          // If copy successful, remove the old file
          await supabase.storage
            .from('telegram-media')
            .remove([message.storage_path]);
        } else {
          console.error(`Error copying file: ${copyError.message}`);
          // We'll continue anyway and update the path in the database
        }
      } catch (storageError) {
        console.error(`Storage operation error: ${storageError.message}`);
        // Continue and update the path
      }
    }

    // Update the message with the standardized path
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        storage_path: standardizedPath,
        storage_path_standardized: true
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }

    return {
      message_id: messageId,
      original_path: message.storage_path || undefined,
      standardized_path,
      success: true
    };
  } catch (error) {
    console.error(`Error standardizing path for message ${messageId}:`, error);
    return {
      message_id: messageId,
      standardized_path: '',
      success: false,
      error: error.message
    };
  }
}

// Serve the HTTP request
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { messageIds, limit = 50 } = await req.json();
    
    // Get messages to process
    let query = supabase
      .from('messages')
      .select('id, file_unique_id, mime_type, storage_path, storage_exists')
      .is('storage_path_standardized', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // If specific message IDs were provided, use them
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results: StoragePathResult[] = [];
    const successful: string[] = [];
    const failed: string[] = [];
    
    // Process each message sequentially
    for (const message of messages) {
      try {
        const result = await standardizeStoragePath(message.id);
        if (result.success) {
          successful.push(message.id);
        } else {
          failed.push(message.id);
        }
        results.push(result);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failed.push(message.id);
        results.push({
          message_id: message.id,
          standardized_path: '',
          success: false,
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        successful: successful.length,
        failed: failed.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: corsHeaders }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  xdelo_isViewableMimeType, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_repairContentDisposition,
  xdelo_recoverFileMetadata,
  xdelo_validateAndFixStoragePath
} from "../_shared/mediaUtils.ts";
import { supabaseClient as supabase } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { action, messageId, messageIds } = await req.json();
    
    // Action router
    switch (action) {
      case 'fix_content_disposition':
        return await fixContentDisposition(messageIds);
      case 'recover_file_metadata':
        return await recoverFileMetadata(messageId || messageIds);
      case 'validate_media_files':
        return await validateMediaFiles(messageIds);
      case 'fix_missing_mime_types':
        return await fixMissingMimeTypes();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in media-management function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

// Fix content disposition for specified messages or batch of latest files
async function fixContentDisposition(messageIds?: string[]) {
  try {
    let query = supabase.from('messages').select('id, storage_path, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, get the latest 100 files
      query = query.order('created_at', { ascending: false }).limit(100);
    }
    
    // Only process files with storage paths
    query = query.not('storage_path', 'is', null);
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const successful = [];
    const failed = [];
    
    // Process each message's file
    for (const message of messages) {
      try {
        if (message.storage_path) {
          const success = await xdelo_repairContentDisposition(`telegram-media/${message.storage_path}`);
          
          if (success) {
            successful.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: true
            });
          } else {
            failed.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: false,
              error: 'Failed to repair content disposition'
            });
          }
        } else {
          failed.push(message.id);
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            success: false,
            error: 'No storage path available'
          });
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failed.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
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
    console.error('Error in fixContentDisposition:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Recover file metadata for specific messages
async function recoverFileMetadata(messageIdOrIds: string | string[]) {
  try {
    const messageIds = Array.isArray(messageIdOrIds) 
      ? messageIdOrIds 
      : [messageIdOrIds];
    
    const results = [];
    
    for (const messageId of messageIds) {
      const result = await xdelo_recoverFileMetadata(messageId);
      results.push({
        message_id: messageId,
        ...result
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recoverFileMetadata:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Validate media files exist in storage
async function validateMediaFiles(messageIds?: string[]) {
  try {
    let query = supabase.from('messages').select('id, storage_path, public_url, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise get a reasonable batch
      query = query.order('created_at', { ascending: false }).limit(50);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const issues = [];
    
    for (const message of messages) {
      // Skip messages without storage path
      if (!message.storage_path) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'missing_storage_path'
        });
        issues.push(message.id);
        continue;
      }
      
      // Check if the file exists in storage
      const exists = await supabase.storage
        .from('telegram-media')
        .createSignedUrl(message.storage_path, 60)
        .then(({ data, error }) => {
          return !error && !!data;
        })
        .catch(() => false);
      
      if (!exists) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'file_not_found',
          storage_path: message.storage_path
        });
        issues.push(message.id);
      } else {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'file_exists',
          storage_path: message.storage_path
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        total: messages.length,
        issues: issues.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validateMediaFiles:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Fix missing MIME types
async function fixMissingMimeTypes() {
  try {
    // Get messages with missing or default MIME types
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, telegram_data, mime_type, file_unique_id')
      .or('mime_type.is.null,mime_type.eq.application/octet-stream')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    const results = [];
    
    for (const message of messages) {
      try {
        // Skip messages without telegram_data
        if (!message.telegram_data) {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'skipped',
            reason: 'no_telegram_data'
          });
          continue;
        }
        
        // Extract media components from telegram_data
        const telegramData = message.telegram_data;
        const mediaObj = {
          photo: telegramData.photo,
          video: telegramData.video,
          document: telegramData.document,
          audio: telegramData.audio,
          voice: telegramData.voice
        };
        
        // Detect MIME type
        const mimeType = xdelo_detectMimeType(mediaObj);
        
        // Skip if we couldn't detect a better MIME type
        if (mimeType === 'application/octet-stream' && message.mime_type === 'application/octet-stream') {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'skipped',
            reason: 'cannot_detect_better_mime_type'
          });
          continue;
        }
        
        // Update the message with the detected MIME type
        const { error: updateError } = await supabase
          .from('messages')
          .update({ mime_type: mimeType })
          .eq('id', message.id);
        
        if (updateError) {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'error',
            error: updateError.message
          });
        } else {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'updated',
            old_mime_type: message.mime_type,
            new_mime_type: mimeType
          });
        }
      } catch (processError) {
        console.error(`Error processing message ${message.id}:`, processError);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'error',
          error: processError.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fixMissingMimeTypes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

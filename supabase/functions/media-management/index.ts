
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { 
  xdelo_getFileExtension,
  xdelo_uploadMediaToStorage,
  xdelo_validateStoragePath,
  xdelo_repairContentDisposition
} from "../_shared/mediaUtils.ts";
import { getStoragePublicUrl } from "../_shared/urls.ts";

// Helper to detect MIME type from file extension
function getMimeTypeFromExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'jpg':
    case 'jpeg': 
      return 'image/jpeg';
    case 'png': 
      return 'image/png';
    case 'gif': 
      return 'image/gif';
    case 'webp': 
      return 'image/webp';
    case 'mp4': 
      return 'video/mp4';
    case 'mov': 
      return 'video/quicktime';
    case 'pdf': 
      return 'application/pdf';
    case 'mp3': 
      return 'audio/mpeg';
    case 'm4a': 
      return 'audio/mp4';
    case 'ogg': 
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

// Main function to serve the edge function
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    // Parse request body
    const { action, fileUrl, fileUniqueId, mediaType, mimeType, storagePath } = await req.json();
    const correlationId = crypto.randomUUID();
    
    // Log the request
    console.log(`Handling ${action} request:`, { fileUniqueId, mediaType, correlationId });
    
    // Handle different actions
    switch (action) {
      case 'upload':
        return await handleUpload(fileUrl, fileUniqueId, mediaType, mimeType, correlationId);
        
      case 'validate':
        return await handleValidate(storagePath, correlationId);
        
      case 'repair':
        return await handleRepair(storagePath, correlationId);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

// Handle media upload using shared utilities
async function handleUpload(
  fileUrl: string, 
  fileUniqueId: string, 
  mediaType: string, 
  explicitMimeType: string | undefined,
  correlationId: string
): Promise<Response> {
  try {
    // Determine MIME type
    const mimeType = explicitMimeType || getMimeTypeFromExt(fileUrl) || 'application/octet-stream';
    
    // Generate storage path using the shared utility
    const storagePath = `${fileUniqueId}.${mimeType.split('/')[1] || 'bin'}`;
    
    console.log(`Downloading media from ${fileUrl} with MIME type ${mimeType}`);
    
    // Download media from URL
    const mediaResponse = await fetch(fileUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`);
    }
    
    // Get media as blob
    const mediaBlob = await mediaResponse.blob();
    
    console.log(`Uploading to storage path: ${storagePath}`);
    
    // Use the shared upload utility to handle the upload with correct settings
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(
      mediaBlob,
      storagePath
    );
    
    if (!success || !publicUrl) {
      throw new Error("Failed to upload media to storage");
    }
    
    // Log the successful upload
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_upload',
      correlation_id: correlationId,
      metadata: {
        file_unique_id: fileUniqueId,
        storage_path: storagePath,
        mime_type: mimeType
      }
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        publicUrl, 
        storagePath: `telegram-media/${storagePath}`,
        mimeType
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    
    // Log the error
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_upload_error',
      correlation_id: correlationId,
      metadata: {
        file_unique_id: fileUniqueId,
        error: error.message
      }
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

// Handle storage validation using shared utility
async function handleValidate(storagePath: string, correlationId: string): Promise<Response> {
  try {
    // Use shared utility to validate storage path
    const exists = await xdelo_validateStoragePath(storagePath);
    
    return new Response(
      JSON.stringify({ success: true, exists }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Validation error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

// Handle media repair using shared utility - no longer requires mime type
async function handleRepair(storagePath: string, correlationId: string): Promise<Response> {
  try {
    // Use shared utility to repair content disposition
    const success = await xdelo_repairContentDisposition(storagePath);
    
    if (!success) {
      throw new Error(`Failed to repair file at ${storagePath}`);
    }
    
    // Log the successful repair
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_repair',
      correlation_id: correlationId,
      metadata: {
        storage_path: storagePath
      }
    });
    
    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Repair error:', error);
    
    // Log the error
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_repair_error',
      correlation_id: correlationId,
      metadata: {
        storage_path: storagePath,
        error: error.message
      }
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

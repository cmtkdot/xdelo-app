
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { 
  xdelo_getFileExtension,
  xdelo_uploadMediaToStorage,
  xdelo_validateStoragePath,
  xdelo_repairContentDisposition,
  xdelo_constructStoragePath,
  xdelo_getUploadOptions
} from "../_shared/mediaUtils.ts";
import { getStoragePublicUrl } from "../_shared/urls.ts";

// Helper to get MIME type from file extension and mediaType
function getMimeType(extension: string, mediaType?: string): string {
  // Comprehensive map of extensions to MIME types
  const mimeMap: Record<string, string> = {
    // Images
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    
    // Telegram specific
    'tgs': 'application/gzip', // Telegram animated stickers
  };

  // Handle special cases from Telegram media types
  if (mediaType) {
    if (mediaType.includes('photo')) return 'image/jpeg';
    if (mediaType.includes('video')) return 'video/mp4';
  }

  return mimeMap[extension.toLowerCase()] || `application/${extension}`;
}

// Helper function to validate and sanitize extensions
function getSafeExtension(extension?: string, mediaType?: string): string {
  if (!extension || extension === 'bin') {
    return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
  }
  
  // Only allow valid extensions (alphanumeric, 1-5 chars)
  if (/^[a-z0-9]{1,5}$/i.test(extension)) {
    return extension.toLowerCase();
  }
  
  return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
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
    const { action, fileUrl, fileUniqueId, mediaType, extension, storagePath } = await req.json();
    const correlationId = crypto.randomUUID();
    
    // Log the request
    console.log(`Handling ${action} request:`, { fileUniqueId, mediaType, extension, correlationId });
    
    // Handle different actions
    switch (action) {
      case 'upload':
        return await handleUpload(fileUrl, fileUniqueId, mediaType, extension, correlationId);
        
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

// Handle media upload with explicit content type
async function handleUpload(
  fileUrl: string, 
  fileUniqueId: string, 
  mediaType: string, 
  requestedExtension: string | undefined,
  correlationId: string
): Promise<Response> {
  try {
    // Determine extension and sanitize it
    let extension = getSafeExtension(requestedExtension, mediaType);
    
    // Force specific extensions based on mediaType for standardization
    if (mediaType.includes('photo')) {
      extension = 'jpeg';
    } else if (mediaType.includes('video')) {
      extension = 'mp4';
    }
    
    // Generate storage path
    const storagePath = xdelo_constructStoragePath(fileUniqueId, extension);
    
    console.log(`Downloading media from ${fileUrl} with extension ${extension}`);
    
    // Download media from URL
    const mediaResponse = await fetch(fileUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`);
    }
    
    // Get media as blob
    const mediaBlob = await mediaResponse.blob();
    
    // Get correct MIME type for this extension and media type
    const mimeType = getMimeType(extension, mediaType);
    console.log(`Uploading to storage path: ${storagePath} with MIME type: ${mimeType}`);
    
    // Upload with explicit content type
    const { error } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBlob, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
        contentDisposition: 'inline'
      });
    
    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    // Generate public URL
    const publicUrl = getStoragePublicUrl(storagePath);
    
    // Log the successful upload
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_upload',
      correlation_id: correlationId,
      metadata: {
        file_unique_id: fileUniqueId,
        storage_path: storagePath,
        extension,
        mime_type: mimeType
      }
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        publicUrl, 
        storagePath,
        mimeType,
        extension
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

// Handle media repair using shared utility
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

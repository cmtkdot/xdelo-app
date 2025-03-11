
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

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
        return await handleRepair(storagePath, mimeType, correlationId);
      
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

// Handle media upload
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
    
    // Generate storage path
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
    
    // Upload to storage
    const { error: uploadError } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBlob, {
        contentType: mimeType,
        upsert: true // Always replace existing files
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
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

// Handle storage validation
async function handleValidate(storagePath: string, correlationId: string): Promise<Response> {
  try {
    // Extract bucket and path
    const parts = storagePath.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    
    if (!bucket || !path) {
      throw new Error('Invalid storage path format');
    }
    
    // Check if file exists
    const { data, error } = await supabaseClient
      .storage
      .from(bucket)
      .download(path, { range: { offset: 0, length: 1 } });
    
    const exists = !error && !!data;
    
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

// Handle media repair
async function handleRepair(storagePath: string, mimeType: string, correlationId: string): Promise<Response> {
  try {
    // Extract bucket and path
    const parts = storagePath.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    
    if (!bucket || !path) {
      throw new Error('Invalid storage path format');
    }
    
    // Download existing file
    const { data, error } = await supabaseClient
      .storage
      .from(bucket)
      .download(path);
    
    if (error || !data) {
      throw new Error(`Failed to download file: ${error?.message || 'File not found'}`);
    }
    
    // Re-upload with correct content type
    const { error: uploadError } = await supabaseClient
      .storage
      .from(bucket)
      .upload(path, data, {
        contentType: mimeType,
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Repair failed: ${uploadError.message}`);
    }
    
    // Log the successful repair
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_management_repair',
      correlation_id: correlationId,
      metadata: {
        storage_path: storagePath,
        mime_type: mimeType
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

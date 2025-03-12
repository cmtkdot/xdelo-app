
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { handleError, withErrorHandling } from "../_shared/errorHandler.ts";
import { SecurityLevel } from "../_shared/jwt-verification.ts";

interface FixContentDispositionRequest {
  messageId: string;
  contentDisposition?: 'inline' | 'attachment';
}

const DEFAULT_MIME_TYPES_MAP = {
  // Images - should be displayed inline
  'image/jpeg': 'inline',
  'image/jpg': 'inline',
  'image/png': 'inline',
  'image/gif': 'inline',
  'image/webp': 'inline',
  'image/svg+xml': 'inline',
  'image/bmp': 'inline',
  
  // Videos - should be displayed inline
  'video/mp4': 'inline',
  'video/quicktime': 'inline',
  'video/mpeg': 'inline',
  'video/webm': 'inline',
  'video/ogg': 'inline',
  'video/x-msvideo': 'inline',
  
  // Documents - should typically be downloaded as attachments
  'application/pdf': 'attachment',
  'application/msword': 'attachment',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'attachment',
  'application/vnd.ms-excel': 'attachment',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'attachment',
  'application/vnd.ms-powerpoint': 'attachment',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'attachment',
  
  // Archives - should be downloaded as attachments
  'application/zip': 'attachment',
  'application/x-rar-compressed': 'attachment',
  'application/x-tar': 'attachment',
  'application/gzip': 'attachment',
  
  // Default for unknown types
  'application/octet-stream': 'attachment'
};

/**
 * Gets the recommended content disposition based on MIME type
 */
function getRecommendedContentDisposition(mimeType: string): 'inline' | 'attachment' {
  if (!mimeType) return 'attachment';
  return DEFAULT_MIME_TYPES_MAP[mimeType] || 'attachment';
}

async function handleFixContentDisposition(req: Request, correlationId: string) {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageId, contentDisposition } = await req.json() as FixContentDispositionRequest;
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ success: false, error: "Message ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get the message
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, file_unique_id, storage_path, mime_type, storage_exists, mime_type_verified')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !message) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError?.message || "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if file exists in storage
    if (!message.storage_exists || !message.storage_path) {
      return new Response(
        JSON.stringify({ success: false, error: "File does not exist in storage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Determine content disposition
    const disposition = contentDisposition || getRecommendedContentDisposition(message.mime_type);
    
    // Update the storage metadata
    const bucketName = 'telegram-media';
    const filePath = message.storage_path;
    
    // Get existing metadata
    const { data: metadata, error: metadataError } = await supabaseClient
      .storage
      .from(bucketName)
      .getMetadata(filePath);
    
    if (metadataError) {
      return new Response(
        JSON.stringify({ success: false, error: metadataError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Prepare new metadata
    const updatedMetadata = {
      ...metadata,
      cacheControl: 'public, max-age=31536000',
      contentType: message.mime_type,
      contentDisposition: `${disposition}; filename="${message.file_unique_id}"`,
    };
    
    // Update metadata in storage
    const { error: updateError } = await supabaseClient
      .storage
      .from(bucketName)
      .updateMetadata(filePath, updatedMetadata);
    
    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Update the message record
    const { error: updateMessageError } = await supabaseClient
      .from('messages')
      .update({
        content_disposition: disposition,
        storage_metadata: updatedMetadata,
        mime_type_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (updateMessageError) {
      return new Response(
        JSON.stringify({ success: false, error: updateMessageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log the operation
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'content_disposition_fixed',
        entity_id: messageId,
        correlation_id: correlationId,
        metadata: {
          content_disposition: disposition,
          mime_type: message.mime_type,
          storage_path: message.storage_path,
          file_unique_id: message.file_unique_id
        },
        event_timestamp: new Date().toISOString()
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Content disposition updated successfully",
        content_disposition: disposition,
        mime_type: message.mime_type
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleError(error, "Error updating content disposition");
  }
}

// Use the withErrorHandling wrapper
serve(withErrorHandling(
  'xdelo_fix_content_disposition',
  handleFixContentDisposition,
  { securityLevel: SecurityLevel.PUBLIC }
));

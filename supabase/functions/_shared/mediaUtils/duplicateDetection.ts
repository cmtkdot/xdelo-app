
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Check if a file with this file_unique_id already exists
 */
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
) {
  if (!fileUniqueId) {
    return { exists: false, message: null };
  }

  try {
    console.log(`Checking for existing file with file_unique_id: ${fileUniqueId}`);
    
    const { data: existingMessage, error } = await supabase
      .from('messages')
      .select('id, storage_path, public_url, mime_type, width, height, duration, file_size')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking for duplicate file:', error);
      return { exists: false, message: null };
    }
    
    if (existingMessage && existingMessage.storage_path) {
      console.log(`Found existing file: ${existingMessage.id} with path ${existingMessage.storage_path}`);
      return { exists: true, message: existingMessage };
    }
    
    return { exists: false, message: null };
  } catch (error) {
    console.error('Error in duplicate detection:', error);
    return { exists: false, message: null, error: error.message };
  }
}

/**
 * Detect and handle duplicate media uploads
 */
export async function xdelo_handleDuplicateMedia(
  supabase: SupabaseClient,
  fileUniqueId: string,
  messageId: string,
  correlationId: string
) {
  try {
    const { exists, message } = await xdelo_findExistingFile(supabase, fileUniqueId);
    
    if (exists && message) {
      console.log(`[${correlationId}] Duplicate file detected, linking message ${messageId} to existing file ${message.id}`);
      
      // Update the current message to reference the existing file
      await supabase
        .from('messages')
        .update({
          is_duplicate: true,
          duplicate_reference_id: message.id,
          storage_path: message.storage_path,
          public_url: message.public_url,
          mime_type: message.mime_type,
          width: message.width,
          height: message.height,
          duration: message.duration,
          file_size: message.file_size,
          storage_exists: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      // Log the duplicate detection
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'duplicate_media_detected',
          entity_id: messageId,
          metadata: {
            file_unique_id: fileUniqueId,
            existing_message_id: message.id,
            storage_path: message.storage_path,
            correlation_id: correlationId
          },
          event_timestamp: new Date().toISOString(),
          correlation_id: correlationId
        });
        
      return { isDuplicate: true, existingFile: message };
    }
    
    return { isDuplicate: false, existingFile: null };
  } catch (error) {
    console.error(`[${correlationId}] Error handling duplicate media:`, error);
    return { isDuplicate: false, existingFile: null, error: error.message };
  }
}

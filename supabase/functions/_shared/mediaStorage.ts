import { SupabaseClient } from "@supabase/supabase-js";
import { 
  xdelo_generateStoragePath, 
  xdelo_getExtensionFromMimeType, 
  xdelo_detectMimeType,
  xdelo_findExistingFile,
  xdelo_verifyFileExists,
  xdelo_uploadMediaToStorage,
  xdelo_downloadMediaFromTelegram,
  xdelo_processMessageMedia
} from "./mediaUtils.ts";

// This file now serves as a compatibility layer for existing code that still 
// uses these functions directly. New code should import from mediaUtils.ts directly.

// Re-export functions from mediaUtils for backward compatibility
export { 
  xdelo_getExtensionFromMimeType,
  xdelo_verifyFileExists,
  xdelo_findExistingFile
};

// Legacy function - redirects to improved version in mediaUtils.ts
export function xdelo_standardizeMimeType(telegramData: any): string {
  return xdelo_detectMimeType(telegramData);
}

// Legacy function - redirects to improved version in mediaUtils.ts
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  return xdelo_generateStoragePath(fileUniqueId, mimeType);
}

// Legacy function - redirects to improved version in mediaUtils.ts
export async function xdelo_uploadFileToStorage(
  supabase: SupabaseClient,
  fileData: Blob,
  storagePath: string,
  mimeType: string,
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; error?: string }> {
  const result = await xdelo_uploadMediaToStorage(
    storagePath,
    fileData,
    mimeType,
    undefined, // No message ID
    bucket
  );
  
  return {
    success: result.success,
    error: result.error
  };
}

// Legacy function - redirects to improved version in mediaUtils.ts
export async function xdelo_processMessageMedia(
  supabase: SupabaseClient,
  telegramData: any,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string,
  messageId?: string
): Promise<{ 
  success: boolean; 
  isDuplicate: boolean; 
  fileInfo: any; 
  error?: string 
}> {
  return xdelo_processMessageMedia(
    telegramData,
    fileId,
    fileUniqueId,
    telegramBotToken,
    messageId
  );
}

// Utility to repair storage paths in bulk - moved from the old file with some improvements
export async function xdelo_repairStoragePaths(
  supabase: SupabaseClient,
  messageIds?: string[],
  limit: number = 100
): Promise<{ processed: number; repaired: number; failed: number; details: any[] }> {
  try {
    // Build query to find messages to repair
    let query = supabase
      .from('messages')
      .select('id, file_unique_id, mime_type, storage_path, public_url')
      .eq('deleted_from_telegram', false)
      .is('file_unique_id', 'not', null);
      
    // If specific message IDs provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise limit to recent messages
      query = query.order('created_at', { ascending: false }).limit(limit);
    }
    
    const { data: messages, error: queryError } = await query;
    
    if (queryError) {
      throw new Error(`Failed to fetch messages: ${queryError.message}`);
    }
    
    console.log(`Found ${messages?.length || 0} messages to process`);
    
    const results = {
      processed: messages?.length || 0,
      repaired: 0,
      failed: 0,
      details: []
    };
    
    // Process each message
    for (const message of messages || []) {
      try {
        if (!message.file_unique_id || !message.mime_type) {
          results.details.push({
            message_id: message.id,
            success: false,
            reason: 'Missing file_unique_id or mime_type'
          });
          results.failed++;
          continue;
        }
        
        // Generate standardized storage path using the new utility
        const storagePath = xdelo_generateStoragePath(
          message.file_unique_id,
          message.mime_type
        );
        
        // If storage path has changed, update it
        if (storagePath !== message.storage_path) {
          // Check if file exists at the old path
          const oldPathExists = message.storage_path ? 
            await xdelo_verifyFileExists(supabase, message.storage_path) : 
            false;
          
          // Check if file exists at the new path  
          const newPathExists = await xdelo_verifyFileExists(supabase, storagePath);
          
          let publicUrl = message.public_url;
          let needsUpdate = true;
          
          if (!newPathExists && oldPathExists) {
            // File exists at old path but not new path, attempt to copy
            try {
              await supabase.storage
                .from('telegram-media')
                .copy(message.storage_path, storagePath);
              
              publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
            } catch (copyError) {
              console.error(`Error copying file from ${message.storage_path} to ${storagePath}:`, copyError);
              results.details.push({
                message_id: message.id,
                success: false,
                error: `Copy failed: ${copyError.message}`,
                old_path: message.storage_path,
                new_path: storagePath
              });
              results.failed++;
              continue;
            }
          } else if (!newPathExists && !oldPathExists) {
            // File doesn't exist in either location
            results.details.push({
              message_id: message.id,
              success: false,
              error: 'File not found in storage',
              old_path: message.storage_path,
              new_path: storagePath
            });
            
            // Mark for redownload
            await supabase
              .from('messages')
              .update({
                needs_redownload: true,
                redownload_reason: 'Storage path repair - file not found',
                redownload_flagged_at: new Date().toISOString()
              })
              .eq('id', message.id);
              
            results.failed++;
            continue;
          } else if (newPathExists) {
            // File already exists at new path
            publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
          }
          
          // Update the database with the new path
          if (needsUpdate) {
            await supabase
              .from('messages')
              .update({
                storage_path: storagePath,
                public_url: publicUrl,
                storage_path_standardized: true
              })
              .eq('id', message.id);
            
            results.details.push({
              message_id: message.id,
              success: true,
              old_path: message.storage_path,
              new_path: storagePath
            });
            
            results.repaired++;
          }
        } else {
          // Path already correct, verify file exists
          const fileExists = await xdelo_verifyFileExists(supabase, storagePath);
          
          if (!fileExists) {
            // File doesn't exist even though path is correct
            await supabase
              .from('messages')
              .update({
                needs_redownload: true,
                redownload_reason: 'Storage path correct but file missing',
                redownload_flagged_at: new Date().toISOString()
              })
              .eq('id', message.id);
            
            results.details.push({
              message_id: message.id,
              success: false,
              error: 'File not found in storage despite correct path',
              path: storagePath
            });
            
            results.failed++;
          } else {
            results.details.push({
              message_id: message.id,
              success: true,
              status: 'already_correct',
              path: storagePath
            });
          }
        }
      } catch (messageError) {
        console.error(`Error processing message ${message.id}:`, messageError);
        results.details.push({
          message_id: message.id,
          success: false,
          error: messageError.message
        });
        results.failed++;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in repairStoragePaths:', error);
    throw error;
  }
}

// Update message processing state - a utility function that's used in various places
export async function xdelo_updateMessageProcessingState(
  supabase: SupabaseClient,
  messageId: string,
  state: string,
  correlationId: string,
  errorMessage?: string
) {
  try {
    const updates: Record<string, any> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };
    
    if (state === 'completed') {
      updates.processing_completed_at = new Date().toISOString();
    } else if (state === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
      updates.last_error_at = new Date().toISOString();
      updates.retry_count = await supabase.rpc('increment_retry_count', { 
        p_message_id: messageId 
      }).single();
    }
    
    const { error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error updating message state:`, error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error in xdelo_updateMessageProcessingState:`, error);
    return { success: false, error: error.message };
  }
}

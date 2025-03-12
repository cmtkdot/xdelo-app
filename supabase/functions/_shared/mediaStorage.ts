import { SupabaseClient } from "@supabase/supabase-js";

// Simple function to get file extension from MIME type
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  const simpleExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/x-tgsticker': 'tgs',
    'text/plain': 'txt'
  };
  
  return simpleExtensions[mimeType] || mimeType.split('/')[1] || 'bin';
}

// Simplified function to standardize MIME type
export function xdelo_standardizeMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  // Simplified MIME type detection focusing on main categories
  if (telegramData.photo) return 'image/jpeg';
  if (telegramData.video) return 'video/mp4';
  
  // For documents, trust Telegram's MIME type if available
  if (telegramData.document?.mime_type) return telegramData.document.mime_type;
  
  // Other media types
  if (telegramData.audio) return 'audio/mpeg';
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  return 'application/octet-stream';
}

// Generate simplified storage path - just fileUniqueId.extension
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = xdelo_getExtensionFromMimeType(mimeType);
  return `${fileUniqueId}.${extension}`;
}

// Check if file actually exists in storage
export async function xdelo_verifyFileExists(
  supabase: SupabaseClient,
  storagePath: string,
  bucket: string = 'telegram-media'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);
    
    return !error && !!data;
  } catch (error) {
    console.error('Error verifying file existence:', error);
    return false;
  }
}

// Find existing file by file_unique_id
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  try {
    // Find message with this file_unique_id
    const { data: existingMessages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .eq('deleted_from_telegram', false)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !existingMessages?.length) {
      return { exists: false };
    }
    
    const existingMessage = existingMessages[0];
    
    // Verify the file actually exists in storage
    if (existingMessage.storage_path) {
      const fileExists = await xdelo_verifyFileExists(
        supabase, 
        existingMessage.storage_path
      );
      
      if (fileExists) {
        return { exists: true, message: existingMessage };
      } else {
        // File doesn't actually exist in storage
        return { exists: false };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error finding existing file:', error);
    return { exists: false };
  }
}

// Upload file to storage with proper options
export async function xdelo_uploadFileToStorage(
  supabase: SupabaseClient,
  fileData: Blob,
  storagePath: string,
  mimeType: string,
  bucket: string = 'telegram-media'
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    // Determine if the file should be viewable in browser
    const isViewable = ['image/', 'video/', 'audio/', 'text/', 'application/pdf'].some(
      prefix => mimeType.startsWith(prefix)
    );
    
    // Set upload options
    const uploadOptions = {
      contentType: mimeType,
      upsert: true, // Overwrite if exists
      cacheControl: '3600',
      contentDisposition: isViewable ? 'inline' : 'attachment'
    };
    
    // Upload the file
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileData, uploadOptions);
    
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    
    // Generate public URL
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${bucket}/${storagePath}`;
    
    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Process media for a message with duplicate detection
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
  try {
    // Step 1: Check if this file already exists in our system
    const { exists, message: existingMessage } = await xdelo_findExistingFile(
      supabase,
      fileUniqueId
    );
    
    // If file exists and is properly stored, reuse it
    if (exists && existingMessage) {
      console.log(`Duplicate file detected: ${fileUniqueId}, reusing existing file`);
      
      // If messageId provided, update the message to reference existing file
      if (messageId) {
        await supabase
          .from('messages')
          .update({
            is_duplicate: true,
            duplicate_reference_id: existingMessage.id,
            storage_path: existingMessage.storage_path,
            public_url: existingMessage.public_url,
            mime_type: existingMessage.mime_type,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
      
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingMessage.storage_path,
          public_url: existingMessage.public_url,
          mime_type: existingMessage.mime_type,
          file_id: fileId,
          file_unique_id: fileUniqueId,
          width: existingMessage.width,
          height: existingMessage.height,
          duration: existingMessage.duration,
          file_size: existingMessage.file_size
        }
      };
    }
    
    // Step 2: Not a duplicate, need to download and process the file
    console.log(`New file detected: ${fileUniqueId}, downloading from Telegram`);
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }
    
    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();
    
    // Step 3: Determine MIME type and storage path
    const mimeType = xdelo_standardizeMimeType(telegramData);
    const storagePath = xdelo_generateStoragePath(fileUniqueId, mimeType);
    
    // Step 4: Upload to storage
    const uploadResult = await xdelo_uploadFileToStorage(
      supabase,
      fileData,
      storagePath,
      mimeType
    );
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload file: ${uploadResult.error}`);
    }
    
    // Step 5: Get media dimensions
    const media = telegramData.photo ? 
      telegramData.photo[telegramData.photo.length - 1] : 
      telegramData.video || telegramData.document;
    
    const fileInfo_ = {
      storage_path: storagePath,
      public_url: uploadResult.publicUrl,
      mime_type: mimeType,
      mime_type_original: telegramData.video?.mime_type || telegramData.document?.mime_type,
      file_id: fileId,
      file_unique_id: fileUniqueId,
      width: media?.width,
      height: media?.height,
      duration: telegramData.video?.duration,
      file_size: media?.file_size
    };
    
    // Step 6: If messageId provided, update the message
    if (messageId) {
      await supabase
        .from('messages')
        .update({
          ...fileInfo_,
          is_duplicate: false,
          storage_exists: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return {
      success: true,
      isDuplicate: false,
      fileInfo: fileInfo_
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    return {
      success: false,
      isDuplicate: false,
      fileInfo: null,
      error: error.message
    };
  }
}

// Utility to repair storage paths in bulk
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
        
        // Generate simplified storage path
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

// Update the increment_retry_count call to use the correct parameters
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
    
    // Log the state change
    // await xdelo_logProcessingEvent(
    //   'message_state_changed',
    //   messageId,
    //   correlationId,
    //   { old_state: state === 'error' ? 'processing' : null, new_state: state },
    //   errorMessage
    // );
    
    return { success: true };
  } catch (error) {
    console.error(`Error in xdelo_updateMessageProcessingState:`, error);
    return { success: false, error: error.message };
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Helper to determine if the MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const viewableTypes = [
    'image/',
    'video/',
    'audio/',
    'text/',
    'application/pdf'
  ];
  return viewableTypes.some(type => mimeType.startsWith(type));
}

// Get default MIME type based on media type
export function xdelo_getDefaultMimeType(media: any): string {
  if (!media) return 'application/octet-stream';
  
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker?.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  if (media.document?.mime_type) return media.document.mime_type;
  
  return 'application/octet-stream';
}

// Detect MIME type from Telegram media object with improved accuracy
export function xdelo_detectMimeType(media: any): string {
  if (!media) return 'application/octet-stream';
  
  // First check for explicit mime_type in document
  if (media.document?.mime_type) {
    return media.document.mime_type;
  }
  
  // Then check specific media types
  if (media.photo) return 'image/jpeg';
  if (media.video?.mime_type) return media.video.mime_type;
  if (media.video) return 'video/mp4';
  if (media.audio?.mime_type) return media.audio.mime_type;
  if (media.audio) return 'audio/mpeg';
  if (media.voice?.mime_type) return media.voice.mime_type;
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker?.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  
  return 'application/octet-stream';
}

// Helper to get proper upload options based on MIME type
export function xdelo_getUploadOptions(mimeType: string): any {
  // Default options for all uploads
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    // Set cache control for better performance
    cacheControl: '3600',
    // Always set contentDisposition based on mime type
    contentDisposition: xdelo_isViewableMimeType(mimeType) ? 'inline' : 'attachment'
  };
  
  return options;
}

// Validate if a file exists in storage
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  // Extract bucket name and file path
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  // If no bucket/path provided, return false
  if (!bucket || !filePath) return false;
  
  try {
    // Check if file exists
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(filePath.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: filePath.split('/').pop() || ''
      });
      
    return !error && !!data?.length;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}

// Helper to repair media content disposition
export async function xdelo_repairContentDisposition(path: string): Promise<boolean> {
  if (!path) return false;
  
  // Extract bucket name and file path
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  // If no bucket/path provided, return false
  if (!bucket || !filePath) return false;
  
  try {
    // Get file metadata to determine MIME type
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucket)
      .download(filePath);
      
    if (fileError || !fileData) {
      console.error('Error downloading file for repair:', fileError);
      return false;
    }
    
    // Determine MIME type
    const mimeType = fileData.type || 'application/octet-stream';
    
    // Re-upload with correct content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileData, { ...uploadOptions, upsert: true });
      
    return !uploadError;
  } catch (err) {
    console.error('Error repairing content disposition:', err);
    return false;
  }
}

// New helper to normalize file extensions based on MIME type
export function xdelo_getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
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
  
  return mimeToExt[mimeType] || mimeType.split('/')[1] || 'bin';
}

// New function to validate and correct storage path
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = xdelo_getFileExtensionFromMimeType(mimeType);
  // Create a properly structured path using Year/Month folders for better organization
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  return `${year}/${month}/${fileUniqueId}.${extension}`;
}

// New function to repair and recover file metadata
export async function xdelo_recoverFileMetadata(messageId: string): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'No data returned'}`);
    }
    
    // Extract necessary information
    const { file_unique_id, file_id, mime_type, storage_path, public_url } = message;
    
    if (!file_unique_id) {
      throw new Error('Message has no file_unique_id');
    }
    
    let updatedData: any = {};
    
    // 1. Check if mime_type needs correction
    if (!mime_type || mime_type === 'application/octet-stream') {
      // Try to detect better MIME type from existing data
      const detectedMimeType = xdelo_detectMimeType({
        photo: message.telegram_data?.photo,
        video: message.telegram_data?.video,
        document: message.telegram_data?.document,
        audio: message.telegram_data?.audio,
        voice: message.telegram_data?.voice
      });
      
      if (detectedMimeType !== 'application/octet-stream') {
        updatedData.mime_type = detectedMimeType;
      }
    }
    
    // 2. Check if storage_path needs correction
    if (!storage_path || storage_path.split('/').length < 2) {
      const correctedPath = xdelo_validateAndFixStoragePath(
        file_unique_id, 
        updatedData.mime_type || mime_type || 'application/octet-stream'
      );
      updatedData.storage_path = correctedPath;
    }
    
    // 3. Update public_url if needed
    if (!public_url || public_url.indexOf(file_unique_id) === -1) {
      updatedData.public_url = `${process.env.SUPABASE_URL}/storage/v1/object/public/telegram-media/${updatedData.storage_path || storage_path}`;
    }
    
    // 4. If we have changes, update the record
    if (Object.keys(updatedData).length > 0) {
      const { error: updateError } = await supabase
        .from('messages')
        .update(updatedData)
        .eq('id', messageId);
        
      if (updateError) {
        throw new Error(`Failed to update message: ${updateError.message}`);
      }
      
      return {
        success: true,
        message: 'File metadata recovered successfully',
        data: { ...updatedData, id: messageId }
      };
    }
    
    return {
      success: true,
      message: 'No recovery needed, file metadata is valid',
      data: { id: messageId }
    };
  } catch (error) {
    console.error('Error recovering file metadata:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

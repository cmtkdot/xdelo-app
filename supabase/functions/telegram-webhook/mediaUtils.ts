
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { logMessageOperation } from './logger.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

// Create Supabase client with storage capabilities
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  // Check if file already exists in the database
  const { data: existingFile } = await supabase
    .from('messages')
    .select('file_unique_id, storage_path, public_url')
    .eq('file_unique_id', media.file_unique_id)
    .limit(1)

  // If we already have this file, return the existing information
  if (existingFile && existingFile.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`)
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: video ? (video.mime_type || 'video/mp4') :
                document ? (document.mime_type || 'application/octet-stream') :
                'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: existingFile[0].storage_path,
      public_url: existingFile[0].public_url,
      is_duplicate: true
    }
  }

  try {
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
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
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Get mime type and extension
    const mimeType = video ? (video.mime_type || 'video/mp4') :
                  document ? (document.mime_type || 'application/octet-stream') :
                  'image/jpeg';
    
    const extension = mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Generate public URL with correct path
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;

    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      is_duplicate: false
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails, construct a URL based on file_unique_id and mark for redownload
    const mimeType = video ? (video.mime_type || 'video/mp4') : 
                  document ? (document.mime_type || 'application/octet-stream') : 
                  'image/jpeg';
    const extension = mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;
    
    // Log the error but don't throw - we'll return a placeholder and flag for redownload
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      needs_redownload: true,
      error: error.message
    };
  }
}

// Simplified function to redownload missing files
export const redownloadMissingFile = async (message: any) => {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    if (!message.file_id) {
      throw new Error('Missing file_id for redownload');
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${message.file_id}`
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
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Extract storage path or create from file_unique_id and mime_type
    const mimeType = message.mime_type || 'image/jpeg';
    const extension = mimeType.split('/')[1];
    const storagePath = `${message.file_unique_id}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        storage_path: storagePath,
        error_message: null
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message after redownload: ${updateError.message}`);
    }

    // Log success
    await logMessageOperation('success', crypto.randomUUID(), {
      action: 'redownload_completed',
      file_unique_id: message.file_unique_id,
      storage_path: storagePath
    });

    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: storagePath
    };
  } catch (error) {
    console.error('Failed to redownload file:', error);
    
    // Update the message with failure info
    try {
      await supabase
        .from('messages')
        .update({
          redownload_attempts: (message.redownload_attempts || 0) + 1,
          error_message: `Redownload failed: ${error.message}`,
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);
    } catch (updateErr) {
      console.error('Error updating error state:', updateErr);
    }
    
    // Log failure
    await logMessageOperation('error', crypto.randomUUID(), {
      action: 'redownload_failed',
      file_unique_id: message.file_unique_id,
      error: error.message
    });
    
    return {
      success: false,
      message_id: message.id,
      error: error.message
    };
  }
}

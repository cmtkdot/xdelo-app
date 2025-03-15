
/**
 * Get the appropriate file extension for a MIME type
 */
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  const mimeToExtension: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/mpeg': 'mpeg',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
    'text/plain': 'txt',
    'text/html': 'html',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'weba'
  };

  return mimeToExtension[mimeType] || 'bin';
}

/**
 * Detect MIME type from Telegram message structure
 */
export function xdelo_detectMimeType(telegramData: any): string {
  // Photo messages
  if (telegramData.photo && telegramData.photo.length > 0) {
    return 'image/jpeg'; // Telegram always sends photos as JPEG
  }
  
  // Video messages
  if (telegramData.video) {
    return telegramData.video.mime_type || 'video/mp4';
  }
  
  // Document messages
  if (telegramData.document) {
    // If document has a mime_type, use it
    if (telegramData.document.mime_type) {
      return telegramData.document.mime_type;
    }
    
    // Try to guess from file name if available
    if (telegramData.document.file_name) {
      const extension = telegramData.document.file_name.split('.').pop()?.toLowerCase();
      const extensionToMime: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'txt': 'text/plain'
      };
      
      if (extension && extensionToMime[extension]) {
        return extensionToMime[extension];
      }
    }
  }
  
  // Audio messages
  if (telegramData.audio) {
    return telegramData.audio.mime_type || 'audio/mpeg';
  }
  
  // Voice messages
  if (telegramData.voice) {
    return telegramData.voice.mime_type || 'audio/ogg';
  }
  
  // Stickers
  if (telegramData.sticker) {
    return telegramData.sticker.is_animated ? 'application/x-tgsticker' : 'image/webp';
  }
  
  // Default fallback
  return 'application/octet-stream';
}

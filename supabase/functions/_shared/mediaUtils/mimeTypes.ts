// Determine if a file should be viewable in browser based on its MIME type
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  return (
    mimeType.startsWith('image/') || 
    mimeType.startsWith('video/') || 
    mimeType.startsWith('audio/') || 
    mimeType.startsWith('text/') || 
    mimeType === 'application/pdf'
  );
}

// Get file extension from MIME type with improved mapping
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  const extensionMap: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/ogg': 'ogv',
    'video/mpeg': 'mpg',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/x-tgsticker': 'tgs',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    
    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'text/csv': 'csv',
    
    // Others
    'application/json': 'json',
    'application/xml': 'xml',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/x-7z-compressed': '7z',
    'application/x-rar-compressed': 'rar'
  };

  // If we have an exact match, use it
  if (extensionMap[mimeType]) {
    return extensionMap[mimeType];
  }
  
  // Otherwise extract the subtype
  const subtype = mimeType.split('/')[1];
  if (subtype) {
    // Clean up the subtype (remove parameters, etc.)
    const cleanSubtype = subtype.split(';')[0].trim();
    return cleanSubtype || 'bin';
  }
  
  return 'bin'; // Default fallback
}

// Improved function to detect and standardize MIME type from Telegram data
export function xdelo_detectMimeType(telegramData: any): string {
  if (!telegramData) return 'application/octet-stream';
  
  // Log the telegram data for debugging
  console.log('Detecting MIME type from telegram data:', JSON.stringify({
    has_photo: !!telegramData.photo,
    has_document: !!telegramData.document,
    has_video: !!telegramData.video,
    document_mime_type: telegramData.document?.mime_type,
    video_mime_type: telegramData.video?.mime_type
  }));
  
  // Handle photo (always JPEG from Telegram)
  if (telegramData.photo && telegramData.photo.length > 0) {
    return 'image/jpeg';
  }
  
  // Use mime_type from document if available
  if (telegramData.document?.mime_type) {
    // Log the document MIME type being used
    console.log(`Using document mime_type: ${telegramData.document.mime_type}`);
    return telegramData.document.mime_type;
  }
  
  // Use mime_type from video if available
  if (telegramData.video?.mime_type) {
    // Log the video MIME type being used
    console.log(`Using video mime_type: ${telegramData.video.mime_type}`);
    return telegramData.video.mime_type;
  }
  
  // Handle other media types with specific detection
  if (telegramData.video) return 'video/mp4';
  if (telegramData.audio) return telegramData.audio.mime_type || 'audio/mpeg';
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  // If we made it here without finding a MIME type, log a warning
  console.warn('Could not detect MIME type from telegram data, falling back to octet-stream');
  
  // Default fallback
  return 'application/octet-stream';
}

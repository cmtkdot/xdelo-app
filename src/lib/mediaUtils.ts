/**
 * Utility functions for media handling
 */

/**
 * Determines if a file should be viewable in the browser based on its MIME type
 */
export function isViewableMediaType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  return (
    mimeType.startsWith('image/') || 
    mimeType.startsWith('video/') || 
    mimeType === 'application/pdf'
  );
}

/**
 * Maps file extensions to MIME types for common formats
 */
export function getMimeTypeFromExtension(extension: string): string {
  const extensionMap: {[key: string]: string} = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'avif': 'image/avif',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    
    // Other
    'txt': 'text/plain',
    'bin': 'application/octet-stream'
  };
  
  const normalized = extension.toLowerCase().replace('.', '');
  return extensionMap[normalized] || 'application/octet-stream';
}

/**
 * Gets a standardized file extension from a MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  if (!mimeType) return 'bin';
  
  // Extract the part after the slash
  const parts = mimeType.split('/');
  let extension = parts[1] || 'bin';
  
  // Handle special cases
  switch (extension) {
    case 'jpeg':
    case 'jpg':
      return 'jpeg';
    case 'quicktime':
      return 'mov';
    case 'x-matroska':
      return 'mkv';
    case 'vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'octet-stream':
      return 'bin';
    default:
      return extension;
  }
}

/**
 * Constructs a standardized storage path for a file
 */
export function constructStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `${fileUniqueId}.${extension}`;
}

/**
 * Gets upload options based on MIME type for Supabase Storage
 */
export function getUploadOptions(mimeType: string): any {
  // Default options
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true
  };
  
  // Add inline content disposition for viewable types
  if (isViewableMediaType(mimeType)) {
    return {
      ...options,
      contentDisposition: 'inline'
    };
  }
  
  return options;
}


// Helper to determine if the MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType === 'application/pdf';
}

// Helper to get proper upload options based on MIME type
export function xdelo_getUploadOptions(mimeType: string): any {
  // Default options for all uploads
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true
  };
  
  // Add inline content disposition for viewable types
  if (xdelo_isViewableMimeType(mimeType)) {
    return {
      ...options,
      contentDisposition: 'inline'
    };
  }
  
  return options;
}


# Explicit Content Type Handling

This update adds comprehensive content type handling to the media upload process to ensure consistent viewing behavior for uploaded media files.

## Key Improvements

1. **Expanded MIME Type Mapping**
   - Added a comprehensive MIME type map with Telegram-specific formats
   - Added support for stickers (tgs, webp, webm)
   - Added all common document formats that Telegram supports
   - Added proper handling for animated content

2. **Enhanced Extension Detection**
   - Improved `xdelo_getExtensionFromMedia` with better Telegram format detection
   - Added fallback to extract extensions from filenames
   - Added validation and sanitization of extensions
   - Uses Telegram file path to extract extensions when available

3. **Consistent Upload Process**
   - Always re-uploads media with explicit content types
   - Extracts file extensions from paths correctly
   - Uses caching headers for better performance
   - Always sets inline content disposition for browser viewing

4. **Improved Error Handling**
   - Better recovery from content type issues
   - Detailed logging for content type detection
   - Sanitized extension handling for security

## Implementation Details

### Comprehensive Content Type Mapping

```typescript
const mimeMap: Record<string, string> = {
  // Images
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  
  // Videos
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
  
  // Audio
  'mp3': 'audio/mpeg',
  'ogg': 'audio/ogg',
  'wav': 'audio/wav',
  
  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // Telegram specific
  'tgs': 'application/gzip', // Telegram animated stickers
  // ...and many more
};
```

### Enhanced Upload Options

```typescript
return {
  contentType: mimeMap[extension.toLowerCase()] || `application/${extension}`,
  contentDisposition: 'inline',
  upsert: true,
  cacheControl: isViewable ? 'public, max-age=31536000' : 'no-cache'
};
```

### Improved Extension Detection

```typescript
// Try to extract extension from mime_type if available
if (media.document?.mime_type) {
  const parts = media.document.mime_type.split('/');
  if (parts.length === 2 && parts[1] !== 'octet-stream') {
    return parts[1];
  }
  // For documents, try to extract from file_name if available
  if (media.document.file_name) {
    const nameParts = media.document.file_name.split('.');
    if (nameParts.length > 1) {
      const ext = nameParts.pop()?.toLowerCase();
      if (ext && ext.length > 0 && ext.length < 5) {
        return ext;
      }
    }
  }
}

// Special handling for stickers
if (media.sticker) {
  if (media.sticker.is_animated) return 'tgs';
  if (media.sticker.is_video) return 'webm';
  return 'webp';
}
```

## Benefits

1. **Better Browser Support** - Files display correctly in browsers with proper MIME types
2. **Telegram Format Support** - Special handling for Telegram-specific formats like stickers
3. **Performance Optimization** - Cache control headers for static content
4. **Better Format Detection** - Multiple fallback mechanisms for extension detection
5. **Security Improvements** - Extension sanitization and validation
6. **Consistent Media Experience** - Uniform handling across all platforms

## Usage

The system is transparent to users and automatically handles all media types. Files are always re-uploaded with the correct content type settings to ensure consistent viewing experience.

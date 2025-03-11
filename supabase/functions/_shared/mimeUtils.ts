
// MIME type utilities
// @ts-ignore - Allow Deno global
declare const Deno: any;

/**
 * Get extension from MIME type with proper defaults
 */
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  // Standardize mime type to lowercase for comparison
  const normalizedMime = mimeType.toLowerCase();
  
  // Handle common image types first
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') return 'jpeg';
  if (normalizedMime === 'image/png') return 'png';
  if (normalizedMime === 'image/gif') return 'gif';
  if (normalizedMime === 'image/webp') return 'webp';
  
  // Handle video types
  if (normalizedMime === 'video/mp4') return 'mp4';
  if (normalizedMime === 'video/quicktime') return 'mov';
  
  // Handle audio types
  if (normalizedMime === 'audio/mpeg') return 'mp3';
  if (normalizedMime === 'audio/mp4') return 'm4a';
  if (normalizedMime === 'audio/ogg') return 'ogg';
  
  // Handle document types
  if (normalizedMime === 'application/pdf') return 'pdf';
  if (normalizedMime === 'application/x-tgsticker') return 'tgs';
  
  // Extract extension from mime type if possible
  const parts = normalizedMime.split('/');
  if (parts.length === 2 && parts[1] !== 'octet-stream') {
    return parts[1];
  }
  
  // Default to bin for unknown types
  return 'bin';
}

/**
 * Get default MIME type based on media type string
 */
export function xdelo_getDefaultMimeType(mediaType: string): string {
  switch (mediaType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    case 'voice':
      return 'audio/ogg';
    case 'animation':
      return 'video/mp4';
    case 'document':
    default:
      return 'application/octet-stream';
  }
}

// Enhanced detection of MIME type from Telegram media object
export function xdelo_detectMimeType(media: any): string {
  // Try to extract from the media object directly
  if (media.document?.mime_type) return media.document.mime_type;
  if (media.video?.mime_type) return media.video.mime_type;
  if (media.audio?.mime_type) return media.audio.mime_type;
  if (media.voice?.mime_type) return media.voice.mime_type;
  
  // Default MIME types based on media type
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker && media.sticker.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  
  return 'application/octet-stream';
}

// Determine if a MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return /^(image\/|video\/|audio\/|text\/|application\/pdf)/.test(mimeType);
}

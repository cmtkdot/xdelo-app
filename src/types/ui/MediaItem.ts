
import type { MediaItemProps } from '../entities/MediaItem';

/**
 * Re-export MediaItem from entities to maintain backwards compatibility
 */
export type MediaItem = MediaItemProps;

/**
 * Utility function to determine media type from MIME type
 */
export function getMediaType(mimeType?: string): 'image' | 'video' | 'document' | 'audio' | 'unknown' {
  if (!mimeType) return 'unknown';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/')) return 'document';
  
  return 'unknown';
}


/**
 * Standard interface for media items in the application
 */
export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'unknown';
  thumbnail?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

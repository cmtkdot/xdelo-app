
import type { AnalyzedContent } from '../utils/AnalyzedContent';

/**
 * Standard MediaItem type for use across the application
 */
export interface MediaItem {
  id: string;
  public_url: string;
  mime_type?: string;
  file_unique_id: string;
  created_at: string;
  caption?: string;
  width?: number;
  height?: number;
  file_size?: number;
  duration?: number;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
  analyzed_content?: AnalyzedContent;
  type?: 'image' | 'video' | 'document' | 'audio' | 'unknown';
}

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

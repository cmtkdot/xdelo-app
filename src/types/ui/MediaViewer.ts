
import type { AnalyzedContent } from '../utils/AnalyzedContent';

/**
 * Media item type used by the MediaViewer component
 */
export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'unknown';
  thumbnail?: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  uploadedAt?: string;
  
  // Legacy properties for compatibility
  public_url?: string;
  mime_type?: string;
  file_unique_id?: string;
  analyzed_content?: AnalyzedContent;
  created_at?: string;
  caption?: string;
}

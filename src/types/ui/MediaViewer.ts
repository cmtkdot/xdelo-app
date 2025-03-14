
import type { AnalyzedContent } from '../utils/AnalyzedContent';

/**
 * Media item type used by the MediaViewer component
 */
export interface MediaItem {
  id: string;
  public_url: string;
  mime_type?: string;
  file_unique_id: string;
  analyzed_content?: AnalyzedContent;
  created_at: string;
  caption?: string;
  width?: number;
  height?: number;
  file_size?: number;
  duration?: number;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
  type?: 'image' | 'video' | 'document' | 'audio' | 'unknown';
}

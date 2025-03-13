
import type { AnalyzedContent } from '../utils/AnalyzedContent';

/**
 * MediaItem entity represents a media file stored in the system
 */
export interface MediaItem {
  id: string;
  public_url: string;
  mime_type?: string;
  file_unique_id: string;
  created_at: string;
  caption?: string;
  analyzed_content?: AnalyzedContent;
  width?: number;
  height?: number;
  file_size?: number;
  duration?: number;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
}

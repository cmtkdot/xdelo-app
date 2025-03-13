
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
}

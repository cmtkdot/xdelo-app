
import { AnalyzedContent } from './index';

// This is a legacy type for compatibility, 
// the main definition is now in src/types/ui/MediaViewer.ts
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
}

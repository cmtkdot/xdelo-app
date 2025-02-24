import { AnalyzedContent } from './Message';

export interface MediaItem {
  id: string;
  public_url?: string;
  mime_type?: string;
  created_at: string;
  analyzed_content?: AnalyzedContent;
  file_id?: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  caption?: string;
}


import type { AnalyzedContent } from '../utils/AnalyzedContent';

/**
 * Media item type used by the MediaViewer component
 * Includes both new properties and legacy properties for backward compatibility
 */
export interface MediaItem {
  // Core properties
  id: string;
  url: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'unknown';
  
  // Standard properties
  thumbnail?: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  uploadedAt?: string;
  
  // Legacy properties for backward compatibility
  public_url?: string;
  mime_type?: string;
  file_unique_id?: string;
  analyzed_content?: AnalyzedContent;
  created_at?: string;
  caption?: string;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
  file_size?: number;
}

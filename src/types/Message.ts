export interface Message {
  id: string;
  created_at: string;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  media_group_id?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  };
  file_name?: string;
  analyzed_content?: AnalyzedContent;
  processing_state?: ProcessingState;
}

export interface AnalyzedContent {
  text?: string;
  tags?: string[];
  categories?: string[];
  sentiment?: string;
  entities?: string[];
  summary?: string;
  created_at?: string;
}

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'failed';

// Component-specific type
export type MessageComponentData = Message;

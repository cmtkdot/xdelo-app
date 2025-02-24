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
  public_url?: string;
  purchase_order?: {
    id: string;
    code: string;
    [key: string]: any;
  };
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
  quantity?: number;
  purchase_date?: string;
}

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'failed';

// Component-specific type
export type MessageComponentData = Message;

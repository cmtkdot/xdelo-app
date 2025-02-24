
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'failed';

export interface Message {
  id: string;
  created_at: string;
  updated_at?: string;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
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
  telegram_message_id?: number;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  telegram_data?: any;
  is_edited?: boolean;
  is_channel?: boolean;
  update_id?: number;
  media_type?: 'photo' | 'video' | 'document';
  is_deleted?: boolean;
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
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  product_sku?: string;
  purchase_order_uid?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    correlation_id?: string;
    needs_review?: boolean;
  };
}

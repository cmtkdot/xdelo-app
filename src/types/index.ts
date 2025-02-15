
export interface FilterValues {
  search: string;
  vendor: string;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  processingState: string;
}

export interface AnalyzedContent {
  quantity?: number;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
  };
}

export interface MediaItem {
  id: string;
  caption: string | null;
  media_group_id: string | null;
  is_original_caption?: boolean;
  chat_id?: number;
  telegram_message_id?: number;
  file_unique_id?: string;
  mime_type?: string;
  analyzed_content?: AnalyzedContent;
  glide_row_id?: string | null;
  vendor?: string;
  product_name?: string;
  created_at: string;
  purchase_date?: string;
}
=======
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'failed';

export interface AnalyzedContent {
  product_name?: string;
  vendor_uid?: string;
  quantity?: number;
  caption?: string;
  method?: string;
  confidence?: number;
  timestamp?: string;
}

export interface Message {
  id: string;
  created_at: string;
  telegram_message_id: number;
  file_unique_id: string;
  user_id: string;
  caption?: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  file_id?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  updated_at?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent | null;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  chat_id?: number;
}

// Alias MediaItem to Message for backward compatibility
export type MediaItem = Message; 

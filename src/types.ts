
export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';
export type SyncStatus = 'pending' | 'synced' | 'error';

export interface FilterValues {
  search?: string;
  dateRange?: { from: Date; to: Date } | null;
  processingState?: ProcessingState[];
  vendors?: string[];
  productCodes?: string[];
  quantity?: { min: number; max: number };
  sortOrder?: 'asc' | 'desc';
}

export interface ParsingMetadata {
  method: 'manual' | 'ai' | 'hybrid';
  confidence: number;
  timestamp: string;
  correlation_id?: string;
  needs_review?: boolean;
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  product_sku?: string;
  purchase_order_uid?: string;
  parsing_metadata?: ParsingMetadata;
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

export interface Message {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  message_url?: string;
  purchase_order?: string;
  glide_row_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
      };
    };
  };
}

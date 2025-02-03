export interface MediaItem {
  id: string;
  telegram_message_id: number;
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
  created_at?: string;
  updated_at?: string;
  user_id: string;
  chat_id?: number;
  processing_state?: 'initialized' | 'processing' | 'completed' | 'error' | 'pending';
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent | null;
  telegram_data?: any;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
}

export interface FilterValues {
  search: string;
  vendor: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder: "asc" | "desc";
  productCode?: string;
  quantityRange?: string;
  processingState?: 'initialized' | 'processing' | 'completed' | 'error' | 'pending' | 'all';
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    confidence: number;
    reanalysis_attempted?: boolean;
    method?: string;
  };
  [key: string]: any;
}

export interface MediaGroup {
  id: string;
  items: MediaItem[];
  mainItem: MediaItem;
  caption?: string;
  productInfo: AnalyzedContent;
}